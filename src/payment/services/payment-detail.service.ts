import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { Payment } from '../entities/payment.entity';
import { PaymentItem } from '../entities/payment-item.entity';
import {
  PaymentDetailResponse,
  GetPaymentDetailParams,
  PaymentItemResponse,
} from '../interfaces/payment-detail.interface';

@Injectable()
export class PaymentDetailService {
  private readonly logger = new Logger(PaymentDetailService.name);

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentItem)
    private paymentItemRepository: Repository<PaymentItem>,
  ) {}

  async getPaymentDetail(
    params: GetPaymentDetailParams,
  ): Promise<PaymentDetailResponse> {
    try {
      const { paymentId, userId } = params;

      this.logger.log(
        `🔍 Buscando detalle del pago ${paymentId} para usuario: ${userId}`,
      );

      // Buscar el pago con sus relaciones
      const payment = await this.paymentRepository.findOne({
        where: { id: paymentId },
        relations: ['paymentConfig', 'items'],
      });

      // Validar que el pago existe
      if (!payment) {
        throw new RpcException({
          status: 404,
          message: 'Pago no encontrado',
        });
      }

      // Validar que el pago pertenece al usuario logueado
      if (payment.userId !== userId) {
        throw new RpcException({
          status: 403,
          message: 'No tienes permisos para acceder a este pago',
        });
      }

      // Formatear y retornar la respuesta
      const formattedPayment = this.formatPaymentDetail(payment);

      this.logger.log(`✅ Detalle del pago ${paymentId} obtenido exitosamente`);

      return formattedPayment;
    } catch (error) {
      this.logger.error(
        `❌ Error obteniendo detalle del pago ${params.paymentId}:`,
        error,
      );

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: 500,
        message: 'Error interno del servidor al obtener el detalle del pago',
      });
    }
  }

  private formatPaymentDetail(payment: Payment): PaymentDetailResponse {
    return {
      id: payment.id,
      amount: payment.amount,
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      operationCode: payment.operationCode,
      bankName: payment.bankName,
      operationDate: payment.operationDate,
      ticketNumber: payment.ticketNumber,
      rejectionReason: payment.rejectionReason,
      reviewedByEmail: payment.reviewedByEmail,
      reviewedAt: payment.reviewedAt,
      isArchived: payment.isArchived,
      relatedEntityType: payment.relatedEntityType,
      relatedEntityId: payment.relatedEntityId,
      metadata: payment.metadata,
      externalReference: payment.externalReference,
      gatewayTransactionId: payment.gatewayTransactionId,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      paymentConfig: {
        id: payment.paymentConfig.id,
        code: payment.paymentConfig.code,
        name: payment.paymentConfig.name,
        description: payment.paymentConfig.description,
      },
      items: this.formatPaymentItems(payment.items || []),
    };
  }

  private formatPaymentItems(items: PaymentItem[]): PaymentItemResponse[] {
    return items
      .sort((a, b) => a.id - b.id) // Ordenar por ID
      .map((item) => ({
        id: item.id,
        itemType: item.itemType,
        url: item.url,
        pointsTransactionId: item.pointsTransactionId,
        amount: item.amount,
        bankName: item.bankName,
        transactionDate: item.transactionDate,
      }));
  }
}
