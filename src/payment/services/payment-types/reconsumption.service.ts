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
import { BonusProcessingService } from '../shared/bonus-processing.service';

@Injectable()
export class ReconsumptionService {
  private readonly logger = new Logger(ReconsumptionService.name);
  private readonly membershipClient: ClientProxy;
  private readonly pointsClient: ClientProxy;

  constructor(private readonly bonusProcessingService: BonusProcessingService) {
    this.membershipClient = ClientProxyFactory.create({
      transport: Transport.NATS,
      options: {
        servers: [envs.NATS_SERVERS],
      },
    });

    this.pointsClient = ClientProxyFactory.create({
      transport: Transport.NATS,
      options: {
        servers: [envs.NATS_SERVERS],
      },
    });
  }
  async processReconsumptionPayment(payment: Payment): Promise<void> {
    this.logger.log(
      `Procesamiento de RECONSUMPTION pendiente para payment ID: ${payment.id}`,
    );
    // Enviar al microservicio de membresía para actualizar a aprobado
    const membershipResponse: {
      newStartDate: string;
      newEndDate: number;
      minReconsumptionAmount: number;
      isPointLLot: boolean;
    } = await firstValueFrom(
      this.membershipClient.send(
        { cmd: 'membership.aproveReconsumption' },
        {
          reconsumptionId: parseInt(payment.relatedEntityId),
          paymentId: payment.id,
          amount: payment.amount,
          approvedAt: new Date(),
        },
      ),
    );

    this.logger.log(
      `Pago de membresía procesado exitosamente para ID: ${payment.relatedEntityId}`,
    );
    if (membershipResponse.isPointLLot) {
      await this.bonusProcessingService.processBinaryVolumePoints(
        payment,
        payment.amount,
      );
      await this.assignPointLotPoints(
        payment.userId,
        payment.userName,
        payment.userEmail,
        200,
      );
    } else {
      await this.bonusProcessingService.processBinaryVolumePoints(
        payment,
        payment.amount,
      );
    }
    await this.bonusProcessingService.processMonthlyVolumePoints(
      payment,
      payment.amount,
    );
  }

  async processReconsumptionRejection(payment: Payment): Promise<void> {
    try {
      this.logger.log(
        `Procesando rechazo de pago de reconsumo para relatedEntityId: ${payment.relatedEntityId}`,
      );

      const data = {
        reconsumptionId: parseInt(payment.relatedEntityId),
        paymentId: payment.id,
        reason: payment.rejectionReason,
      };
      console.log('Data to send:', data);
      await firstValueFrom(
        this.membershipClient.send(
          { cmd: 'membership.rejectReconsumption' },
          data,
        ),
      );

      this.logger.log(
        `Rechazo de pago de reconsumo procesado exitosamente para ID: ${payment.relatedEntityId}`,
      );
    } catch (error) {
      console.error('Error al procesar rechazo de pago de reconsumo:', error);
      this.logger.error(
        `Error al procesar rechazo de pago de reconsumo: ${error.message}`,
      );
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al procesar rechazo de pago de reconsumo',
      });
    }
  }

  private async assignPointLotPoints(
    userId: string,
    userName: string,
    userEmail: string,
    amount: number,
  ): Promise<void> {
    this.logger.log(
      `Asignando ${amount} puntos al banco de PointLot para usuario ${userId}`,
    );

    try {
      await firstValueFrom(
        this.pointsClient.send(
          { cmd: 'pointsLotTransaction.createLotPoints' },
          {
            userId,
            userName,
            userEmail,
            points: amount,
            reference: 'Reconsumo aprobado PointLot',
          },
        ),
      );

      this.logger.log(
        `${amount} puntos PointLot asignados exitosamente para usuario ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error asignando puntos PointLot para usuario ${userId}: ${error.message}`,
      );
    }
  }
}
