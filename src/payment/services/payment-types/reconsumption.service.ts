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
  constructor(private readonly bonusProcessingService: BonusProcessingService) {
    this.membershipClient = ClientProxyFactory.create({
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
    if (membershipResponse.isPointLLot) {
      await this.bonusProcessingService.processBinaryVolumePoints(payment, 100);
      // TODO:AGREGAR PUNTOS DE LOTE
    } else {
      await this.bonusProcessingService.processBinaryVolumePoints(
        payment,
        payment.amount,
      );
    }
  }
  catch(error) {
    this.logger.error(`Error al procesar pago de membresía: ${error.message}`);
    throw new RpcException({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Error al procesar pago de membresía',
    });
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
}
