import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { PointsService } from 'src/common/services/points.service';
import { CreatePaymentData } from 'src/payment/dto/create-payment.dto';
import { Repository } from 'typeorm';
import { PaymentConfig } from '../../entities/payment-config.entity';
import { PaymentItem } from '../../entities/payment-item.entity';
import { Payment } from '../../entities/payment.entity';
import { PaymentItemType } from '../../enum/payment-item.enum';
import { PaymentStatus } from '../../enum/payment-status.enum';
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
      const pointsTransaction = await this.pointsService.deductPointsForPayment(
        data.userId,
        data.username,
        data.userEmail,
        data.amount,
        payment.id,
        `PAY-${payment.id}`,
      );

      // 5. Crear PaymentItem para registrar la transacción de puntos
      const paymentItem = this.paymentItemRepository.create({
        payment: payment,
        itemType: PaymentItemType.POINTS_TRANSACTION,
        amount: data.amount,
        transactionDate: new Date(),
        pointsTransactionId: String(pointsTransaction.transactionId),
      });

      await this.paymentItemRepository.save(paymentItem);

      this.logger.log(
        `Pago POINTS completado exitosamente para usuario ${data.userId}. Puntos descontados: ${data.amount}`,
      );

      return {
        success: true,
        paymentId: payment.id,
        pointsTransactionId: pointsTransaction.transactionId,
        message: 'Pago procesado exitosamente con puntos',
        remainingPoints: userPoints.availablePoints - data.amount,
      };
    } catch (error) {
      this.logger.error(`Error al procesar pago POINTS: ${error.message}`);
      throw error;
    }
  }
}
