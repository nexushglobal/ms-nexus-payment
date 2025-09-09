import {
  forwardRef,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { PointsService } from 'src/common/services/points.service';
import { CreatePaymentData } from 'src/payment/dto/create-payment.dto';
import { WithdrawalsService } from 'src/withdrawals/withdrawals.service';
import { Repository } from 'typeorm';
import { PaymentConfig } from '../../entities/payment-config.entity';
import { PaymentItem } from '../../entities/payment-item.entity';
import { Payment } from '../../entities/payment.entity';
import { PaymentItemType } from '../../enum/payment-item.enum';
import { PaymentStatus } from '../../enum/payment-status.enum';
import { MembershipPaymentService } from '../payment-types/membership-payment.service';
import { OrderPaymentService } from '../payment-types/order-payment.service';
import { PlanUpgradeService } from '../payment-types/plan-upgrade.service';
import { ReconsumptionService } from '../payment-types/reconsumption.service';
import { BasePaymentMethodService } from './base-payment-method.service';

@Injectable()
export class PointsPaymentService extends BasePaymentMethodService {
  protected readonly logger = new Logger(PointsPaymentService.name);

  constructor(
    @InjectRepository(Payment)
    paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentConfig)
    paymentConfigRepository: Repository<PaymentConfig>,
    @InjectRepository(PaymentItem)
    paymentItemRepository: Repository<PaymentItem>,
    private readonly pointsService: PointsService,
    private readonly orderPaymentService: OrderPaymentService,
    private readonly membershipPaymentService: MembershipPaymentService,
    private readonly planUpgradeService: PlanUpgradeService,
    private readonly reconsumptionService: ReconsumptionService,
    @Inject(forwardRef(() => WithdrawalsService))
    private readonly withdrawalsService: WithdrawalsService,
  ) {
    super(paymentRepository, paymentConfigRepository, paymentItemRepository);
  }

  async processPayment(data: CreatePaymentData): Promise<any> {
    this.logger.log(`Procesando pago POINTS para usuario ${data.userId}`);

    try {
      // 1. Validar configuración de pago
      const paymentConfig = await this.validatePaymentConfig(
        data.paymentConfig,
      );

      // 2. Validar que el usuario tenga suficientes puntos
      const userPoints = await this.pointsService.getUserPoints(data.userId);
      if (userPoints.availablePoints < data.amount)
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message: `Puntos insuficientes. Disponibles: ${userPoints.availablePoints}, Requeridos: ${data.amount}`,
        });

      // 3. Crear registro de pago con estado COMPLETED (pago inmediato)
      const paymentData = {
        ...data,
        status: PaymentStatus.COMPLETED,
      };
      const payment = await this.createPaymentRecord(
        paymentData,
        paymentConfig,
      );

      // 4. Descontar puntos del usuario
      // const pointsTransaction = await this.pointsService.deductPointsForPayment(
      //   data.userId,
      //   data.username,
      //   data.userEmail,
      //   data.amount,
      //   payment.id,
      //   `PAY-${payment.id}`,
      // );

      let pointsTransaction;
      try {
        pointsTransaction = await this.withdrawalsService.createWithdrawal({
          userId: data.userId,
          userName: data.username,
          userEmail: data.userEmail,
          userDocumentNumber: 'Retiro de puntos como pago interno', // No disponible en el pago
          userRazonSocial: 'Retiro de puntos como pago interno', // Usar el nombre como razón social
          bankName: 'Retiro de puntos como pago interno', // Se completará cuando el usuario configure su cuenta
          accountNumber: 'Retiro de puntos como pago interno',
          cci: 'Retiro de puntos como pago interno',
          amount: data.amount,
        });
        this.logger.log(
          `Retiro automático registrado por pago POINTS ${payment.id} para usuario ${data.userId}`,
        );
        await this.withdrawalsService.approveWithdrawal(
          pointsTransaction.withdrawal.id as number,
          data.userId,
          data.userEmail,
        );
      } catch (withdrawalError) {
        this.logger.error(
          `Error registrando retiro automático para pago POINTS ${payment.id}: ${withdrawalError.message}`,
        );
        // No lanzamos el error aquí para no revertir el pago, solo log
      }

      // 5. Crear PaymentItem para registrar la transacción de puntos
      const paymentItem = this.paymentItemRepository.create({
        payment: payment,
        itemType: PaymentItemType.POINTS_TRANSACTION,
        amount: data.amount,
        transactionDate: new Date(),
        pointsTransactionId: String(pointsTransaction.transactionId),
      });

      await this.paymentItemRepository.save(paymentItem);

      // 7. Para POINTS, procesar automáticamente según el tipo de pago
      let automaticProcessingResult: any = null;
      try {
        switch (paymentConfig.code) {
          case 'ORDER_PAYMENT':
            automaticProcessingResult =
              await this.orderPaymentService.processOrderPayment(payment);
            this.logger.log(
              `Orden procesada automáticamente para pago POINTS ${payment.id}`,
            );
            break;

          case 'MEMBERSHIP_PAYMENT':
            automaticProcessingResult =
              await this.membershipPaymentService.processMembershipPayment(
                payment,
              );
            this.logger.log(
              `Membresía procesada automáticamente para pago POINTS ${payment.id}`,
            );
            break;

          case 'PLAN_UPGRADE':
            automaticProcessingResult =
              await this.planUpgradeService.processPlanUpgradePayment(payment);
            this.logger.log(
              `Upgrade procesado automáticamente para pago POINTS ${payment.id}`,
            );
            break;

          case 'RECONSUMPTION':
            automaticProcessingResult =
              await this.reconsumptionService.processReconsumptionPayment(
                payment,
              );
            this.logger.log(
              `Reconsumo procesado automáticamente para pago POINTS ${payment.id}`,
            );
            break;

          default:
            this.logger.warn(
              `Tipo de pago ${paymentConfig.code} no requiere procesamiento automático para POINTS`,
            );
            break;
        }
      } catch (processingError) {
        this.logger.error(
          `Error procesando automáticamente pago POINTS ${payment.id}: ${processingError.message}`,
        );
        // No lanzamos el error aquí para no revertir el pago, solo log
      }

      this.logger.log(
        `Pago POINTS completado exitosamente para usuario ${data.userId}. Puntos descontados: ${data.amount}`,
      );

      // 8. Para ORDER_PAYMENT, incluir información actualizada de la orden
      let orderInfo: any = null;
      if (paymentConfig.code === 'ORDER_PAYMENT' && automaticProcessingResult) {
        orderInfo = {
          orderId: parseInt(payment.relatedEntityId),
          status: 'APPROVED', // La orden ya fue aprobada automáticamente
          autoApproved: true,
        };
      }

      return {
        success: true,
        paymentId: payment.id,
        pointsTransactionId: pointsTransaction.transactionId,
        message: 'Pago procesado exitosamente con puntos',
        remainingPoints: userPoints.availablePoints - data.amount,
        ...(orderInfo && { orderInfo }),
      };
    } catch (error) {
      this.logger.error(`Error al procesar pago POINTS: ${error.message}`);
      throw error;
    }
  }
}
