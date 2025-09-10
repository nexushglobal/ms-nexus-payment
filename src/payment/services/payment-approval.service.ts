import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  ApprovePaymentDto,
  CompletePaymentDto,
  RejectPaymentDto,
} from '../dto/approve-payment.dto';
import { Payment } from '../entities/payment.entity';
import { PaymentStatus } from '../enum/payment-status.enum';
import { MembershipPaymentService } from './payment-types/membership-payment.service';
import { OrderPaymentService } from './payment-types/order-payment.service';
import { PlanUpgradeService } from './payment-types/plan-upgrade.service';
import { ReconsumptionService } from './payment-types/reconsumption.service';
import { UserService } from './user/user.service';

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
      const user = await this.userService.getUserById(payment.userId);

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
        Descripción: `Pago aprobado el ${new Date().toLocaleDateString('pe-PE')} a las ${new Date().toLocaleTimeString('pe-PE')}`,
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
          user,
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

  async rejectPayment(
    paymentId: number,
    userId: string,
    rejectPaymentDto: RejectPaymentDto,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const payment = await queryRunner.manager.findOne(Payment, {
        where: { id: paymentId },
        relations: ['paymentConfig'],
      });

      if (!payment) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: 'Payment not found',
        });
      }

      payment.status = PaymentStatus.REJECTED;
      payment.rejectionReason = rejectPaymentDto.rejectionReason;
      const user = await this.userService.getUserById(payment.userId);

      await queryRunner.manager.save(Payment, payment);

      switch (payment.paymentConfig.code) {
        case 'MEMBERSHIP_PAYMENT':
          await this.membershipPaymentService.processMembershipPaymentRejection(
            payment,
          );
          break;
        case 'PLAN_UPGRADE':
          await this.planUpgradeService.processPlanUpgradePaymentRejection(
            payment,
          );
          break;
        case 'RECONSUMPTION':
          await this.reconsumptionService.processReconsumptionRejection(
            payment,
          );
          break;
        case 'ORDER_PAYMENT':
          await this.orderPaymentService.processOrderRejection(payment);
          break;
        default:
          this.logger.warn(
            `Tipo de pago desconocido: ${payment.paymentConfig.code}`,
          );
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `Pago ${paymentId} rechazado exitosamente por usuario ${userId}`,
      );

      return {
        success: true,
        message: 'Pago rechazado exitosamente',
        data: {
          paymentId: paymentId,
          reason: rejectPaymentDto.rejectionReason,
          rejectedBy: userId,
          user,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error al rechazar pago ${paymentId}: ${error.message}`,
      );
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al procesar rechazo de pago',
      });
    } finally {
      await queryRunner.release();
    }
  }

  async completePayment(
    paymentId: number,
    userId: string,
    completePaymentDto: CompletePaymentDto,
  ): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const payment = await queryRunner.manager.findOne(Payment, {
        where: { id: paymentId },
        relations: ['paymentConfig'],
      });

      if (!payment) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: 'Payment not found',
        });
      }

      if (
        payment.status !== PaymentStatus.APPROVED &&
        payment.status !== PaymentStatus.COMPLETED
      ) {
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message: `Payment must be in APPROVED or COMPLETED status to be completed. Current status: ${payment.status}`,
        });
      }

      const wasAlreadyCompleted = payment.status === PaymentStatus.COMPLETED;

      const { codeOperation, numberTicket } = completePaymentDto;
      if (codeOperation) {
        payment.operationCode = codeOperation;
      }
      if (numberTicket) {
        payment.ticketNumber = numberTicket;
      }
      if (codeOperation && numberTicket) {
        payment.status = PaymentStatus.COMPLETED;
      }

      await queryRunner.manager.save(Payment, payment);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Pago ${paymentId} ${wasAlreadyCompleted ? 'actualizado como' : 'marcado como'} COMPLETED por usuario ${userId}`,
      );

      return {
        paymentId: payment.id,
        status: payment.status,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error al completar pago ${paymentId}: ${error.message}`,
      );

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al completar el pago',
      });
    } finally {
      await queryRunner.release();
    }
  }
}
