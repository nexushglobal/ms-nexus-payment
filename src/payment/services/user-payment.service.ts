import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { PaymentConfig } from '../entities/payment-config.entity';
import { Payment } from '../entities/payment.entity';
import {
  GetUserPaymentsParams,
  PaymentResponse,
} from '../interfaces/user-payment.interface';

@Injectable()
export class UserPaymentsService {
  private readonly logger = new Logger(UserPaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentConfig)
    private paymentConfigRepository: Repository<PaymentConfig>,
  ) {}

  async getUserPayments(params: GetUserPaymentsParams): Promise<{
    payments: PaymentResponse[];
    total: number;
  }> {
    try {
      const { userId, limit, offset, filters } = params;
      this.logger.log(`🔍 Buscando pagos para usuario: ${userId}`);
      const queryBuilder = this.buildPaymentsQuery(userId, filters);
      const total = await queryBuilder.getCount();
      queryBuilder.skip(offset).take(limit);
      const payments = await queryBuilder.getMany();
      const formattedPayments = payments.map((payment) =>
        this.formatPayment(payment),
      );
      this.logger.log(
        `✅ Encontrados ${formattedPayments.length} pagos para el usuario ${userId}`,
      );
      return {
        payments: formattedPayments,
        total,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error obteniendo pagos del usuario ${params.userId}:`,
        error,
      );
      throw error;
    }
  }

  async getActivePaymentConfigs(): Promise<PaymentConfig[]> {
    try {
      const activeConfigs = await this.paymentConfigRepository.find({
        where: { isActive: true },
        order: { name: 'ASC' },
        select: ['id', 'name'],
      });
      return activeConfigs;
    } catch (error) {
      this.logger.error(
        '❌ Error obteniendo configuraciones de pago activas:',
        error,
      );
      throw error;
    }
  }

  private buildPaymentsQuery(
    userId: string,
    filters: GetUserPaymentsParams['filters'],
  ): SelectQueryBuilder<Payment> {
    const queryBuilder = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.paymentConfig', 'paymentConfig')
      .where('payment.userId = :userId', { userId });

    if (filters.search && filters.search.trim()) {
      const searchTerm = `%${filters.search.trim()}%`;
      queryBuilder.andWhere(
        '(payment.operationCode ILIKE :search OR payment.ticketNumber ILIKE :search OR paymentConfig.name ILIKE :search OR paymentConfig.code ILIKE :search)',
        { search: searchTerm },
      );
    }

    if (filters.startDate) {
      queryBuilder.andWhere('payment.createdAt >= :startDate', {
        startDate: new Date(filters.startDate),
      });
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setDate(endDate.getDate() + 1);
      queryBuilder.andWhere('payment.createdAt < :endDate', { endDate });
    }

    if (filters.status) {
      queryBuilder.andWhere('payment.status = :status', {
        status: filters.status,
      });
    }

    if (filters.paymentConfigId) {
      queryBuilder.andWhere('paymentConfig.id = :paymentConfigId', {
        paymentConfigId: filters.paymentConfigId,
      });
    }

    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'DESC';

    const sortField = this.mapSortField(sortBy);
    queryBuilder.orderBy(sortField, sortOrder);

    return queryBuilder;
  }

  private mapSortField(sortBy: string): string {
    const sortFieldMap: Record<string, string> = {
      createdAt: 'payment.createdAt',
      updatedAt: 'payment.updatedAt',
      amount: 'payment.amount',
      status: 'payment.status',
    };

    return sortFieldMap[sortBy] || 'payment.createdAt';
  }

  private formatPayment(payment: Payment): PaymentResponse {
    return {
      id: payment.id,
      amount: payment.amount,
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      paymentConfig: {
        name: payment.paymentConfig.name,
      },
    };
  }
}
