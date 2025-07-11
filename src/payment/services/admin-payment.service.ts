import { Injectable, Logger } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { envs } from 'src/config/envs';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { GetAdminPaymentsDto } from '../dto/admin-payments.dto';
import { Payment } from '../entities/payment.entity';
import { PaymentConfig } from '../entities/payment-config.entity';
import { AdminPaymentResponse } from '../interfaces/admin-payment.interface';

@Injectable()
export class AdminPaymentsService {
  private readonly logger = new Logger(AdminPaymentsService.name);
  private readonly usersClient: ClientProxy;

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentConfig)
    private paymentConfigRepository: Repository<PaymentConfig>,
  ) {
    this.usersClient = ClientProxyFactory.create({
      transport: Transport.NATS,
      options: {
        servers: [envs.NATS_SERVERS],
      },
    });
  }

  async getAllPayments(dto: GetAdminPaymentsDto): Promise<{
    payments: AdminPaymentResponse[];
    total: number;
  }> {
    try {
      this.logger.log(
        `🔍 Obteniendo todos los pagos administrativos - Límite: ${dto.limit}, Offset: ${dto.offset}`,
      );

      const queryBuilder = this.buildPaymentsQuery(dto);

      const total = await queryBuilder.getCount();

      queryBuilder.skip(dto.offset).take(dto.limit);

      const payments = await queryBuilder.getMany();

      // Obtener información de usuarios en lote
      const userIds = [...new Set(payments.map((payment) => payment.userId))];
      const usersInfo = await this.getUsersInfoBatch(userIds);

      const formattedPayments = payments.map((payment) =>
        this.formatAdminPayment(payment, usersInfo[payment.userId]),
      );

      this.logger.log(
        `✅ Encontrados ${formattedPayments.length} pagos administrativos`,
      );

      return {
        payments: formattedPayments,
        total,
      };
    } catch (error) {
      this.logger.error('❌ Error obteniendo pagos administrativos:', error);
      throw error;
    }
  }

  private buildPaymentsQuery(
    dto: GetAdminPaymentsDto,
  ): SelectQueryBuilder<Payment> {
    const queryBuilder = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.paymentConfig', 'paymentConfig');

    if (dto.filters?.search && dto.filters.search.trim()) {
      const searchTerm = `%${dto.filters.search.trim()}%`;
      queryBuilder.andWhere(
        '(payment.operationCode ILIKE :search OR payment.ticketNumber ILIKE :search OR paymentConfig.name ILIKE :search OR paymentConfig.code ILIKE :search)',
        { search: searchTerm },
      );
    }

    if (dto.filters?.startDate) {
      queryBuilder.andWhere('payment.createdAt >= :startDate', {
        startDate: new Date(dto.filters.startDate),
      });
    }

    if (dto.filters?.endDate) {
      queryBuilder.andWhere('payment.createdAt <= :endDate', {
        startDate: new Date(dto.filters.endDate),
      });
    }

    if (dto.filters?.status) {
      queryBuilder.andWhere('payment.status = :status', {
        status: dto.filters.status,
      });
    }

    if (dto.filters?.paymentConfigId) {
      queryBuilder.andWhere('payment.paymentConfigId = :paymentConfigId', {
        paymentConfigId: dto.filters.paymentConfigId,
      });
    }

    // Ordenamiento
    const sortBy = dto.filters?.sortBy || 'createdAt';
    const sortOrder = dto.filters?.sortOrder || 'DESC';

    queryBuilder.orderBy(`payment.${sortBy}`, sortOrder);

    return queryBuilder;
  }

  private formatAdminPayment(
    payment: Payment,
    userInfo?: any,
  ): AdminPaymentResponse {
    const defaultUserInfo = {
      id: payment.userId,
      email: payment.userEmail || 'No disponible',
      fullName: 'Usuario no encontrado',
      documentNumber: undefined,
    };

    return {
      id: payment.id,
      amount: payment.amount,
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      operationCode: payment.operationCode,
      ticketNumber: payment.ticketNumber,
      reviewedAt: payment.reviewedAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      paymentConfig: {
        name: payment.paymentConfig.name,
      },
      user: userInfo || defaultUserInfo,
    };
  }

  private async getUsersInfoBatch(userIds: string[]): Promise<{
    [userId: string]: {
      id: string;
      email: string;
      fullName: string;
      documentNumber?: string;
    };
  }> {
    try {
      if (userIds.length === 0) {
        return {};
      }

      this.logger.log(
        `👥 Obteniendo información de ${userIds.length} usuarios`,
      );

      const usersInfo = await firstValueFrom(
        this.usersClient.send({ cmd: 'user.getUsersInfoBatch' }, { userIds }),
      );

      return usersInfo || {};
    } catch (error) {
      this.logger.warn(
        '⚠️ Error obteniendo información de usuarios en lote:',
        error,
      );
      return {};
    }
  }

  async onModuleDestroy() {
    await this.usersClient.close();
  }
}
