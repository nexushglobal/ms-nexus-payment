import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  RpcException,
  Transport,
} from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { envs } from 'src/config/envs';
import { Payment } from '../../entities/payment.entity';
import { PaymentService } from '../payment.service';
import { BonusProcessingService } from '../shared/bonus-processing.service';

@Injectable()
export class MembershipPaymentService {
  private readonly logger = new Logger(MembershipPaymentService.name);
  private readonly membershipClient: ClientProxy;

  constructor(
    private readonly bonusProcessingService: BonusProcessingService,
    private readonly paymentService: PaymentService,
  ) {
    this.membershipClient = ClientProxyFactory.create({
      transport: Transport.NATS,
      options: {
        servers: [envs.NATS_SERVERS],
      },
    });
  }

  async processMembershipPayment(payment: Payment): Promise<void> {
    try {
      this.logger.log(
        `Procesando pago de membresía para relatedEntityId: ${payment.relatedEntityId}`,
      );

      // Enviar al microservicio de membresía para actualizar a aprobado
      const membershipResponse: {
        planName: string;
        binaryPoints: number;
      } = await firstValueFrom(
        this.membershipClient.send(
          { cmd: 'membership.approveMembership' },
          {
            membershipId: parseInt(payment.relatedEntityId),
            paymentId: payment.id,
            amount: payment.amount,
            approvedAt: new Date(),
          },
        ),
      );

      this.logger.log(
        `Pago de membresía procesado exitosamente para ID: ${payment.relatedEntityId}`,
      );

      // Procesar puntos por referido directo
      await this.bonusProcessingService.processDirectReferralBonus(payment, {
        plan: membershipResponse.planName,
      });

      // Procesar puntos de volumen por referido directo
      await this.bonusProcessingService.processBinaryVolumePoints(
        payment,
        membershipResponse.binaryPoints,
      );

      await this.bonusProcessingService.processMonthlyVolumePoints(
        payment,
        membershipResponse.binaryPoints,
      );
    } catch (error) {
      this.logger.error(
        `Error al procesar pago de membresía: ${error.message}`,
      );
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al procesar pago de membresía',
      });
    }
  }

  async processMembershipPaymentRejection(payment: Payment): Promise<void> {
    try {
      this.logger.log(
        `Procesando rechazo de pago de membresía para relatedEntityId: ${payment.relatedEntityId}`,
      );

      const data = {
        membershipId: parseInt(payment.relatedEntityId),
        paymentId: payment.id,
        reason: payment.rejectionReason,
      };
      console.log('Data to send:', data);
      await firstValueFrom(
        this.membershipClient.send(
          { cmd: 'membership.rejectMembership' },
          data,
        ),
      );

      this.logger.log(
        `Rechazo de pago de membresía procesado exitosamente para ID: ${payment.relatedEntityId}`,
      );
    } catch (error) {
      console.error('Error al procesar rechazo de pago de membresía:', error);
      this.logger.error(
        `Error al procesar rechazo de pago de membresía: ${error.message}`,
      );
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al procesar rechazo de pago de membresía',
      });
    }
  }

  async processBinaryVolumePoints(
    paymentId: number,
  ): Promise<{ message: string }> {
    const payment = await this.paymentService.findOne(paymentId);
    if (payment.paymentConfig.code === 'MEMBERSHIP_PAYMENT') {
      const membershipResponse: {
        plan: {
          binaryPoints: number;
        };
      } = await firstValueFrom(
        this.membershipClient.send(
          { cmd: 'membership.getMembershipDetailById' },
          {
            membershipId: parseInt(payment.relatedEntityId),
          },
        ),
      );
      this.logger.log(
        `Pago de membresía procesado exitosamente para ID: ${payment.relatedEntityId}`,
      );
      await this.bonusProcessingService.processBinaryVolumePoints(
        payment,
        membershipResponse.plan.binaryPoints,
      );
      return {
        message:
          'Volumen semanal por pago de memebresía procesado exitosamente',
      };
    }
    await this.bonusProcessingService.processBinaryVolumePoints(
      payment,
      payment.amount,
    );
    return {
      message: 'Volumen semanal por pago de reconsumo procesado exitosamente',
    };
  }

  async onModuleDestroy() {
    await this.membershipClient.close();
  }
}
