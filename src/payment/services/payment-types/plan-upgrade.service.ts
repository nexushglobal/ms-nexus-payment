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
export class PlanUpgradeService {
  private readonly logger = new Logger(PlanUpgradeService.name);
  private readonly membershipClient: ClientProxy;

  constructor() {
    this.membershipClient = ClientProxyFactory.create({
      transport: Transport.NATS,
      options: {
        servers: [envs.NATS_SERVERS],
      },
    });
  }

  async processPlanUpgradePayment(payment: Payment): Promise<void> {
    try {
      this.logger.log(
        `Procesando upgrade de plan para relatedEntityId: ${payment.relatedEntityId}`,
      );

      // Enviar al microservicio de membresía para aprobar el upgrade
      await firstValueFrom(
        this.membershipClient.send(
          { cmd: 'membership.approvePlanUpgrade' },
          {
            membershipId: parseInt(payment.relatedEntityId),
            paymentId: payment.id,
            upgradeAmount: payment.amount,
            approvedAt: new Date(),
          },
        ),
      );

      this.logger.log(
        `Upgrade de plan procesado exitosamente para ID: ${payment.relatedEntityId}`,
      );
    } catch (error) {
      this.logger.error(`Error al procesar upgrade de plan: ${error.message}`);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al procesar upgrade de plan',
      });
    }
  }

  async onModuleDestroy() {
    await this.membershipClient.close();
  }
}
