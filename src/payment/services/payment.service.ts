import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
  ) {}

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
}
