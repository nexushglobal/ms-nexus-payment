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
export class OrderPaymentService {
  private readonly logger = new Logger(OrderPaymentService.name);
  private readonly orderClient: ClientProxy;

  constructor(private readonly bonusProcessingService: BonusProcessingService) {
    this.orderClient = ClientProxyFactory.create({
      transport: Transport.NATS,
      options: {
        servers: [envs.NATS_SERVERS],
      },
    });
  }

  async processOrderPayment(payment: Payment): Promise<void> {
    try {
      this.logger.log(
        `Procesando pago de orden para relatedEntityId: ${payment.relatedEntityId}`,
      );

      // 1. Actualizar status de orden a APPROVED
      const orderResponse: {
        orderId: number;
        status: string;
        totalAmount: number;
        totalItems: number;
        products: Array<{
          productId: number;
          productName: string;
          quantity: number;
          price: number;
        }>;
        binaryPoints: number;
      } = await firstValueFrom(
        this.orderClient.send(
          { cmd: 'orders.internal.updateOrderStatus' },
          {
            orderId: parseInt(payment.relatedEntityId),
            status: 'APPROVED',
            paymentId: payment.id,
          },
        ),
      );

      // 2. Stock se manejará cuando se marque la orden como SENT
      // No hacer nada con stock aquí

      this.logger.log(
        `Pago de orden procesado exitosamente para ID: ${payment.relatedEntityId}, productos: ${orderResponse.products.length}`,
      );

      // 2. Procesar bonos si aplican
      if (orderResponse.binaryPoints > 0) {
        await this.bonusProcessingService.processDirectReferralBonus(payment, {
          tipoOperacion: 'ORDER_PURCHASE',
          orderId: payment.relatedEntityId,
          products: orderResponse.products,
        });

        await this.bonusProcessingService.processBinaryVolumePoints(
          payment,
          orderResponse.binaryPoints,
        );

        await this.bonusProcessingService.processMonthlyVolumePoints(
          payment,
          orderResponse.binaryPoints,
        );

        this.logger.log(
          `Bonos y volúmenes procesados para orden ID: ${payment.relatedEntityId}, puntos: ${orderResponse.binaryPoints}`,
        );
      }

      this.logger.log(
        `Procesamiento completo de orden ID: ${payment.relatedEntityId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error procesando pago de orden ID: ${payment.relatedEntityId}`,
        error,
      );

      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error procesando pago de orden: ${error.message}`,
      });
    }
  }

  async processOrderRejection(payment: Payment): Promise<void> {
    try {
      this.logger.log(
        `Procesando rechazo de pago de orden para relatedEntityId: ${payment.relatedEntityId}`,
      );

      // 1. Actualizar status de orden a REJECTED
      await firstValueFrom(
        this.orderClient.send(
          { cmd: 'orders.internal.updateOrderStatus' },
          {
            orderId: parseInt(payment.relatedEntityId),
            status: 'REJECTED',
            paymentId: payment.id,
            rejectionReason: payment.rejectionReason,
          },
        ),
      );

      // 2. No hay stock que liberar porque nunca se reservó
      // El stock se descuenta solo cuando se envía la orden

      this.logger.log(
        `Rechazo de orden procesado exitosamente para ID: ${payment.relatedEntityId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error procesando rechazo de orden ID: ${payment.relatedEntityId}`,
        error,
      );

      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error procesando rechazo de orden: ${error.message}`,
      });
    }
  }
}
