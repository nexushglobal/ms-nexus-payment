import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  RpcException,
  Transport,
} from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { envs } from 'src/config/envs';
import { TicketStatus } from '../../dto/ticket/ticket-status.enum';
import { UpdateTicketStatusDto } from '../../dto/ticket/update-ticket-status.dto';
import { Payment } from '../../entities/payment.entity';

@Injectable()
export class EventPaymentService {
  private readonly logger = new Logger(EventPaymentService.name);
  private readonly appClient: ClientProxy;

  constructor() {
    this.appClient = ClientProxyFactory.create({
      transport: Transport.NATS,
      options: {
        servers: [envs.NATS_SERVERS],
      },
    });
  }

  async processEventPayment(payment: Payment): Promise<void> {
    try {
      this.logger.log(
        `Procesando pago de evento para ticketId: ${payment.metadata?.ticketId}`,
      );
      // 1. Confirmar ticket - marcar como CONFIRMED y generar QR
      const updateStatusDto: UpdateTicketStatusDto = {
        ticketId: payment.metadata?.ticketId,
        status: TicketStatus.CONFIRMED,
      };
      await firstValueFrom(
        this.appClient.send({ cmd: 'ticket.updateStatus' }, updateStatusDto),
      );
      this.logger.log(
        `Ticket ${payment.metadata?.ticketId} confirmado exitosamente para evento ${payment.metadata?.eventName}`,
      );
      // 2. NO procesar bonos ni volúmenes (según requerimiento)
      // Los tickets de eventos no generan puntos binarios ni volúmenes
      this.logger.log(
        `Procesamiento completo de evento para ticket ID: ${payment.metadata?.ticketId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error procesando pago de evento para ticket ID: ${payment.metadata?.ticketId}`,
        error,
      );

      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error procesando pago de evento: ${error.message}`,
      });
    }
  }

  async processEventRejection(payment: Payment): Promise<void> {
    try {
      this.logger.log(
        `Procesando rechazo de pago de evento para ticketId: ${payment.metadata?.ticketId}`,
      );

      // 1. Marcar ticket como CANCELLED
      const updateStatusDto: UpdateTicketStatusDto = {
        ticketId: payment.metadata?.ticketId,
        status: TicketStatus.CANCELLED,
      };

      await firstValueFrom(
        this.appClient.send({ cmd: 'ticket.updateStatus' }, updateStatusDto),
      );

      this.logger.log(
        `Ticket ${payment.metadata?.ticketId} cancelado exitosamente`,
      );

      this.logger.log(
        `Rechazo de evento procesado para ticket ID: ${payment.metadata?.ticketId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error procesando rechazo de evento para ticket ID: ${payment.metadata?.ticketId}`,
        error,
      );

      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error procesando rechazo de evento: ${error.message}`,
      });
    }
  }
}
