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
import {
  AdminPaymentDetailResponse,
  AdminPaymentItemResponse,
  GetAdminPaymentDetailDto,
} from '../dto/admin-payment-detail.dto';
import { PaymentItem } from '../entities/payment-item.entity';
import { Payment } from '../entities/payment.entity';

@Injectable()
export class AdminPaymentDetailService {
  private readonly logger = new Logger(AdminPaymentDetailService.name);
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
    dto: GetAdminPaymentDetailDto,
  ): Promise<AdminPaymentDetailResponse> {
    try {
      const { paymentId } = dto;

      this.logger.log(
        `🔍 Obteniendo detalle administrativo del pago: ${paymentId}`,
      );

      const payment = await this.paymentRepository.findOne({
        where: { id: paymentId },
        relations: ['paymentConfig', 'items'],
      });

      if (!payment) {
        throw new RpcException({
          status: 404,
          message: 'Pago no encontrado',
        });
      }

      const userInfo = await this.getUserDetailedInfo(payment.userId);

      let reviewedByInfo;
      if (payment.reviewedByEmail) {
        reviewedByInfo = {
          email: payment.reviewedByEmail,
        };
      }

      const paymentDetail = this.formatAdminPaymentDetail(
        payment,
        userInfo,
        reviewedByInfo,
      );

      this.logger.log(
        `✅ Detalle administrativo del pago ${paymentId} obtenido exitosamente`,
      );

      return paymentDetail;
    } catch (error) {
      this.logger.error(
        `❌ Error obteniendo detalle administrativo del pago ${dto.paymentId}:`,
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

  private formatAdminPaymentDetail(
    payment: Payment,
    userInfo: any,
    reviewedByInfo: any,
  ): AdminPaymentDetailResponse {
    return {
      id: payment.id,
      amount: payment.amount,
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      rejectionReason: payment.rejectionReason,
      reviewedAt: payment.reviewedAt,
      relatedEntityType: payment.relatedEntityType,
      relatedEntityId: payment.relatedEntityId,
      metadata: payment.metadata,
      gatewayTransactionId: payment.gatewayTransactionId,
      externalReference: payment.externalReference,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      billing: {
        operationCode: payment.operationCode,
        bankName: payment.bankName,
        operationDate: payment.operationDate,
        ticketNumber: payment.ticketNumber,
      },
      user: userInfo,

      reviewedBy: reviewedByInfo,

      paymentConfig: {
        id: payment.paymentConfig.id,
        code: payment.paymentConfig.code,
        name: payment.paymentConfig.name,
        description: payment.paymentConfig.description,
      },

      // Items del pago
      items: this.formatAdminPaymentItems(payment.items || []),
    };
  }

  private formatAdminPaymentItems(
    items: PaymentItem[],
  ): AdminPaymentItemResponse[] {
    return items
      .sort((a, b) => a.id - b.id)
      .map((item) => ({
        id: item.id,
        itemType: item.itemType,
        url: item.url,
        urlKey: item.urlKey,
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
