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
import {
  AdminPaymentResponse,
  AdminPaymentsResponse,
  GetAdminPaymentsDto,
  PaymentMetadataResponse,
} from '../dto/admin-payments.dto';
import { PaymentConfig } from '../entities/payment-config.entity';
import { Payment } from '../entities/payment.entity';
import { PaymentMethod } from '../enum/patment-method';
import { PaymentStatus } from '../enum/payment-status.enum';

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

  async getPaymentMetadata(): Promise<PaymentMetadataResponse> {
    try {
      this.logger.log('📋 Obteniendo metadatos de pagos');
      this.logger.log('📋 Obteniendo metadatos de pagos');

      const paymentConfigs = await this.paymentConfigRepository.find({
        where: { isActive: true },
        select: ['id', 'name', 'code'],
        order: { name: 'ASC' },
      });

      const paymentMethods = [
        { value: PaymentMethod.VOUCHER, label: 'Voucher' },
        { value: PaymentMethod.POINTS, label: 'Puntos' },
        { value: PaymentMethod.PAYMENT_GATEWAY, label: 'Pasarela de Pago' },
      ];

      const paymentStatuses = [
        { value: PaymentStatus.PENDING, label: 'Pendiente' },
        { value: PaymentStatus.APPROVED, label: 'Aprobado' },
        { value: PaymentStatus.REJECTED, label: 'Rechazado' },
        { value: PaymentStatus.COMPLETED, label: 'Completado' },
      ];

      this.logger.log(
        `✅ Metadatos obtenidos: ${paymentConfigs.length} configuraciones`,
      );

      return {
        paymentMethods,
        paymentStatuses,
        paymentConfigs: paymentConfigs.map((config) => ({
          id: config.id,
          name: config.name,
          code: config.code,
        })),
      };
    } catch (error) {
      this.logger.error('❌ Error obteniendo metadatos de pagos:', error);
      throw error;
    }
  }

  async getAllPayments(
    dto: GetAdminPaymentsDto,
  ): Promise<AdminPaymentsResponse> {
    try {
      this.logger.log(
        `🔍 Obteniendo todos los pagos - Página: ${dto.page}, Límite: ${dto.limit}`,
      );

      const queryBuilder = this.buildPaymentsQuery(dto);

      const total = await queryBuilder.getCount();

      const offset = (dto.page! - 1) * dto.limit!;
      queryBuilder.skip(offset).take(dto.limit);

      const payments = await queryBuilder.getMany();

      this.logger.log(
        `📊 Encontrados ${payments.length} pagos de ${total} totales`,
      );

      const paymentsWithUserInfo =
        await this.enrichPaymentsWithUserInfo(payments);

      const totalPages = Math.ceil(total / dto.limit!);

      return {
        payments: paymentsWithUserInfo,
        pagination: {
          page: dto.page!,
          limit: dto.limit!,
          total,
          totalPages,
        },
      };
    } catch (error) {
      this.logger.error('❌ Error obteniendo todos los pagos:', error);
      throw error;
    }
  }

  private buildPaymentsQuery(
    dto: GetAdminPaymentsDto,
  ): SelectQueryBuilder<Payment> {
    const queryBuilder = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.paymentConfig', 'paymentConfig')
      .where('1 = 1');

    if (dto.search && dto.search.trim()) {
      const searchTerm = `%${dto.search.trim().toLowerCase()}%`;
      queryBuilder.andWhere(
        "(LOWER(payment.userEmail) LIKE :search OR LOWER(payment.userName) LIKE :search OR payment.userId IN (SELECT u.id FROM users u WHERE LOWER(u.email) LIKE :search OR LOWER(CONCAT(u.personalInfo.firstName, ' ', u.personalInfo.lastName)) LIKE :search OR u.personalInfo.documentNumber LIKE :search))",
        { search: searchTerm },
      );
    }

    if (dto.status) {
      queryBuilder.andWhere('payment.status = :status', { status: dto.status });
    }

    if (dto.paymentMethod) {
      queryBuilder.andWhere('payment.paymentMethod = :paymentMethod', {
        paymentMethod: dto.paymentMethod,
      });
    }

    if (dto.paymentConfigId) {
      queryBuilder.andWhere('paymentConfig.id = :paymentConfigId', {
        paymentConfigId: dto.paymentConfigId,
      });
    }

    if (dto.startDate) {
      queryBuilder.andWhere('payment.createdAt >= :startDate', {
        startDate: new Date(dto.startDate),
      });
    }

    if (dto.endDate) {
      const endDate = new Date(dto.endDate);
      endDate.setDate(endDate.getDate() + 1);
      queryBuilder.andWhere('payment.createdAt < :endDate', { endDate });
    }

    queryBuilder.orderBy('payment.createdAt', 'DESC');

    return queryBuilder;
  }

  private async enrichPaymentsWithUserInfo(
    payments: Payment[],
  ): Promise<AdminPaymentResponse[]> {
    const userIds = [...new Set(payments.map((payment) => payment.userId))];

    const usersInfo = await this.getUsersInfoBatch(userIds);

    return payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      operationCode: payment.operationCode,
      ticketNumber: payment.ticketNumber,
      createdAt: payment.createdAt,
      reviewedAt: payment.reviewedAt,
      reviewedByEmail: payment.reviewedByEmail,
      user: usersInfo[payment.userId] || {
        id: payment.userId,
        email: payment.userEmail,
        fullName: payment.userName || 'Usuario desconocido',
        documentNumber: undefined,
      },
      paymentConfig: {
        id: payment.paymentConfig.id,
        name: payment.paymentConfig.name,
        code: payment.paymentConfig.code,
      },
    }));
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
