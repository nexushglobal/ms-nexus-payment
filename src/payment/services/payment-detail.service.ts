import { Injectable, Logger } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  RpcException,
  Transport,
} from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { envs } from 'src/config/envs';
import { Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { PaymentItem } from '../entities/payment-item.entity';
import {
  PaymentDetailResponse,
  GetPaymentDetailParams,
  PaymentItemResponse,
} from '../interfaces/payment-detail.interface';

// Nueva interface para admin que extiende la respuesta normal
export interface AdminPaymentDetailResponse extends PaymentDetailResponse {
  user?: {
    id: string;
    email: string;
    fullName: string;
    phone?: string;
    documentNumber?: string;
  };
}

// Nueva interface para parámetros de admin
export interface GetAdminPaymentDetailParams {
  paymentId: number;
  isAdmin?: boolean;
}

@Injectable()
export class PaymentDetailService {
  private readonly logger = new Logger(PaymentDetailService.name);
  private readonly usersClient: ClientProxy;

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentItem)
    private paymentItemRepository: Repository<PaymentItem>,
  ) {
    this.usersClient = ClientProxyFactory.create({
      transport: Transport.NATS,
      options: {
        servers: [envs.NATS_SERVERS],
      },
    });
  }

  async getPaymentDetail(
    params: GetPaymentDetailParams | GetAdminPaymentDetailParams,
  ): Promise<PaymentDetailResponse | AdminPaymentDetailResponse> {
    try {
      const { paymentId } = params;
      const isAdmin = 'isAdmin' in params ? params.isAdmin : false;
      const userId = 'userId' in params ? params.userId : undefined;

      this.logger.log(
        `🔍 Buscando detalle del pago ${paymentId} ${isAdmin ? '(Admin)' : `para usuario: ${userId}`}`,
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

      // Validar que el pago pertenece al usuario logueado SOLO si NO es admin
      if (!isAdmin && payment.userId !== userId) {
        throw new RpcException({
          status: 403,
          message: 'No tienes permisos para acceder a este pago',
        });
      }

      // Si es admin, obtener información del usuario del pago
      let userInfo;
      if (isAdmin) {
        userInfo = await this.getUserDetailedInfo(payment.userId);
      }

      // Formatear y retornar la respuesta
      const formattedPayment = this.formatPaymentDetail(payment, userInfo);

      this.logger.log(
        `✅ Detalle del pago ${paymentId} obtenido exitosamente ${isAdmin ? '(Admin)' : ''}`,
      );

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

  private async getUserDetailedInfo(userId: string): Promise<{
    id: string;
    email: string;
    fullName: string;
    phone?: string;
    documentNumber?: string;
  }> {
    try {
      this.logger.log(
        `👤 Obteniendo información detallada del usuario: ${userId}`,
      );

      const userInfo = await firstValueFrom(
        this.usersClient.send({ cmd: 'user.getUserDetailedInfo' }, { userId }),
      );

      if (!userInfo) {
        return {
          id: userId,
          email: 'Usuario no encontrado',
          fullName: 'Usuario no encontrado',
          phone: undefined,
          documentNumber: undefined,
        };
      }

      return {
        id: userInfo.id,
        email: userInfo.email,
        fullName: userInfo.fullName,
        phone: userInfo.phone,
        documentNumber: userInfo.documentNumber,
      };
    } catch (error) {
      this.logger.warn(
        `⚠️ Error obteniendo información del usuario ${userId}:`,
        error,
      );

      return {
        id: userId,
        email: 'Error obteniendo información',
        fullName: 'Error obteniendo información',
        phone: undefined,
        documentNumber: undefined,
      };
    }
  }

  private formatPaymentDetail(
    payment: Payment,
    userInfo?: any,
  ): PaymentDetailResponse | AdminPaymentDetailResponse {
    const baseResponse: PaymentDetailResponse = {
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

    // Si hay información de usuario (admin), agregarla a la respuesta
    if (userInfo) {
      const adminResponse: AdminPaymentDetailResponse = {
        ...baseResponse,
        user: userInfo,
      };
      return adminResponse;
    }

    return baseResponse;
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

  async onModuleDestroy() {
    await this.usersClient.close();
  }
}
