import { Injectable, Logger } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { In, Repository } from 'typeorm';
import { envs } from '../../config/envs';
import { PaymentReportData } from '../dto/get-payments-report.dto';
import { Payment } from '../entities/payment.entity';
import { PaymentStatus } from '../enum/payment-status.enum';

interface UserContactInfo {
  userId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  fullName: string;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly userClient: ClientProxy;

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
  ) {
    this.userClient = ClientProxyFactory.create({
      transport: Transport.NATS,
      options: {
        servers: [envs.NATS_SERVERS],
      },
    });
  }

  async findById(id: number): Promise<{
    id: number;
    operationCode?: string;
    paymentMethod: string;
    status: string;
    amount: number;
    bankName?: string;
    userEmail: string;
  } | null> {
    try {
      const payment = await this.paymentRepository.findOne({
        where: { id },
        relations: ['paymentConfig'],
      });

      if (!payment) {
        return null;
      }

      return {
        id: payment.id,
        operationCode: payment.operationCode,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        amount: payment.amount,
        bankName: payment.bankName,
        userEmail: payment.userEmail,
      };
    } catch (error) {
      this.logger.error(`Error buscando pago por ID ${id}:`, error);
      return null;
    }
  }

  // Método adicional para obtener información básica de múltiples pagos
  async findByIds(ids: number[]): Promise<{
    [id: number]: {
      id: number;
      operationCode?: string;
      ticketNumber?: string;
      paymentMethod: string;
      status: string;
      amount: number;
      bankName?: string;
      userEmail: string;
    };
  }> {
    try {
      const payments = await this.paymentRepository.findBy({
        id: ids as any, // TypeORM acepta array para búsqueda IN
      });

      const result: Record<number, any> = {};

      payments.forEach((payment) => {
        result[payment.id] = {
          id: payment.id,
          operationCode: payment.operationCode,
          paymentMethod: payment.paymentMethod,
          status: payment.status,
          amount: payment.amount,
          bankName: payment.bankName,
          userEmail: payment.userEmail,
        };
      });

      return result;
    } catch (error) {
      this.logger.error(`Error buscando pagos por IDs:`, error);
      return {};
    }
  }

  async findByIdsWithReport(
    paymentsIds: { paymentId: string }[],
  ): Promise<Payment[]> {
    const payments = await this.paymentRepository.find({
      where: {
        id: In(paymentsIds.map((p) => parseInt(p.paymentId))),
      },
      // ✅ SIN SELECT - cargar TODA la entidad
    });
    return payments;
  }

  async getPaymentsReport(
    startDate?: string,
    endDate?: string,
  ): Promise<PaymentReportData[]> {
    try {
      const queryBuilder = this.paymentRepository
        .createQueryBuilder('payment')
        .leftJoinAndSelect('payment.paymentConfig', 'paymentConfig')
        // tiene que poder varios status A
        .where('payment.status IN (:...statuses)', {
          statuses: [PaymentStatus.APPROVED, PaymentStatus.COMPLETED],
        })
        .orderBy('payment.createdAt', 'DESC');

      // Aplicar filtros de fecha si se proporcionan
      if (startDate && endDate) {
        queryBuilder.andWhere(
          'payment.createdAt BETWEEN :startDate AND :endDate',
          {
            startDate: new Date(startDate),
            endDate: new Date(endDate + 'T23:59:59.999Z'), // Final del día
          },
        );
      } else if (startDate) {
        queryBuilder.andWhere('payment.createdAt >= :startDate', {
          startDate: new Date(startDate),
        });
      } else if (endDate) {
        queryBuilder.andWhere('payment.createdAt <= :endDate', {
          endDate: new Date(endDate + 'T23:59:59.999Z'),
        });
      }

      const payments = await queryBuilder.getMany();

      if (payments.length === 0) {
        return [];
      }

      // Obtener información de contacto de usuarios
      const userIds = payments.map((p) => p.userId);
      const usersContactInfo = await this.getUsersContactInfo(userIds);

      // Crear un mapa para acceso rápido a la información de contacto
      const contactInfoMap = new Map(
        usersContactInfo.map((user) => [user.userId, user]),
      );

      return payments.map((payment) => {
        const contactInfo = contactInfoMap.get(payment.userId);
        // Usar SOLO la información de contacto de la DB, no los métodos de extracción incorrectos
        const firstName = contactInfo?.firstName || '';
        const lastName = contactInfo?.lastName || '';

        return {
          paymentAmount: payment.amount,
          paymentType: payment.paymentConfig?.name || 'N/A',
          firstName: firstName,
          lastName: lastName,
          email: payment.userEmail,
          created: payment.createdAt,
          paymentMethod: this.formatPaymentMethod(payment.paymentMethod),
        };
      });
    } catch (error) {
      this.logger.error('Error generando reporte de pagos:', error);
      throw error;
    }
  }

  private async getUsersContactInfo(
    userIds: string[],
  ): Promise<UserContactInfo[]> {
    try {
      return await firstValueFrom(
        this.userClient.send<UserContactInfo[]>(
          { cmd: 'users.getUsersContactInfo' },
          { userIds },
        ),
      );
    } catch (error) {
      this.logger.error('Error obteniendo información de contacto:', error);
      // En caso de error, retornar array vacío para no romper el reporte
      return [];
    }
  }

  private extractFirstName(fullName: string): string {
    if (!fullName) return '';
    const nameParts = fullName.trim().split(' ');
    return nameParts[0] || '';
  }

  private extractLastName(fullName: string): string {
    if (!fullName) return '';
    const nameParts = fullName.trim().split(' ');
    return nameParts.slice(1).join(' ') || '';
  }

  private formatPaymentMethod(paymentMethod: string): string {
    const methodMap: { [key: string]: string } = {
      VOUCHER: 'Comprobante',
      POINTS: 'Puntos',
      PAYMENT_GATEWAY: 'Pasarela de Pago',
    };
    return methodMap[paymentMethod] || paymentMethod;
  }
}
