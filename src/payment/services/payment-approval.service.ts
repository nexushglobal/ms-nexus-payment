// src/payment/services/payment-approval.service.ts
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { PaymentStatus } from '../enum/payment-status.enum';
import { ApprovePaymentDto } from '../dto/approve-payment.dto';
import { UserService } from './user/user.service';
import { MembershipPaymentService } from './payment-types/membership-payment.service';
import { PlanUpgradeService } from './payment-types/plan-upgrade.service';
import { ReconsumptionService } from './payment-types/reconsumption.service';
import { OrderPaymentService } from './payment-types/order-payment.service';

@Injectable()
export class PaymentApprovalService {
  private readonly logger = new Logger(PaymentApprovalService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly userService: UserService,
    private readonly membershipPaymentService: MembershipPaymentService,
    private readonly planUpgradeService: PlanUpgradeService,
    private readonly reconsumptionService: ReconsumptionService,
    private readonly orderPaymentService: OrderPaymentService,
    private readonly dataSource: DataSource,
  ) {}

  async approvePayment(
    paymentId: number,
    reviewerId: string,
    approvePaymentDto: ApprovePaymentDto,
  ): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Traer el pago con el ID
      const payment = await this.paymentRepository.findOne({
        where: { id: paymentId },
        relations: ['paymentConfig'],
      });

      if (!payment) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: 'Pago no encontrado',
        });
      }

      // 3. Traer información del usuario que está revisando el pago
      const reviewer = await this.userService.getUserById(reviewerId);

      // 4. Actualizar los datos del pago
      payment.status = PaymentStatus.APPROVED;
      payment.reviewedById = reviewerId;
      payment.reviewedByEmail = reviewer.email;
      payment.reviewedAt = new Date();

      // Actualizar campos opcionales y obligatorios
      if (approvePaymentDto.codeOperation) {
        payment.operationCode = approvePaymentDto.codeOperation;
      }

      payment.bankName = approvePaymentDto.banckName;
      payment.operationDate = new Date(String(approvePaymentDto.dateOperation));

      if (approvePaymentDto.numberTicket) {
        payment.ticketNumber = approvePaymentDto.numberTicket;
      }

      // 5. Agregar metadata
      payment.metadata = {
        ...payment.metadata,
        'Configuración de Pago': payment.paymentConfig.code,
        'Estado del Pago': PaymentStatus.APPROVED,
        Monto: payment.amount,
        Descripción: `Pago aprobado el ${new Date().toLocaleDateString()} a las ${new Date().toLocaleTimeString()}`,
      };

      // Guardar el pago actualizado
      await queryRunner.manager.save(Payment, payment);

      // 6. Procesar según el tipo de configuración de pago
      switch (payment.paymentConfig.code) {
        case 'MEMBERSHIP_PAYMENT':
          await this.membershipPaymentService.processMembershipPayment(payment);
          break;

        case 'PLAN_UPGRADE':
          await this.planUpgradeService.processPlanUpgradePayment(payment);
          break;

        case 'RECONSUMPTION':
          await this.reconsumptionService.processReconsumptionPayment(payment);
          break;

        case 'ORDER_PAYMENT':
          await this.orderPaymentService.processOrderPayment(payment);
          break;

        default:
          this.logger.warn(
            `Tipo de pago desconocido: ${payment.paymentConfig.code}`,
          );
          break;
      }

      await queryRunner.commitTransaction();

      this.logger.log(`Pago ${paymentId} aprobado exitosamente`);

      return {
        success: true,
        message: 'Pago aprobado exitosamente',
        data: {
          paymentId: payment.id,
          status: payment.status,
          reviewedBy: reviewer.email,
          reviewedAt: payment.reviewedAt,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error al aprobar pago ${paymentId}: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
