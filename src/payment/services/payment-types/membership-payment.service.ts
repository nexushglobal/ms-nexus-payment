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

@Injectable()
export class MembershipPaymentService {
  private readonly logger = new Logger(MembershipPaymentService.name);
  private readonly membershipClient: ClientProxy;

  constructor() {
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
      await firstValueFrom(
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

      await firstValueFrom(
        this.membershipClient.send(
          { cmd: 'membership.rejectMembership' },
          {
            membershipId: parseInt(payment.relatedEntityId),
            paymentId: payment.id,
            reason: payment.rejectionReason,
          },
        ),
      );

      this.logger.log(
        `Rechazo de pago de membresía procesado exitosamente para ID: ${payment.relatedEntityId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error al procesar rechazo de pago de membresía: ${error.message}`,
      );
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al procesar rechazo de pago de membresía',
      });
    }
  }

  async onModuleDestroy() {
    await this.membershipClient.close();
  }
}
