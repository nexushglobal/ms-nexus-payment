import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  RpcException,
  Transport,
} from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { envs } from 'src/config/envs';
import { CreatePaymentData } from 'src/payment/dto/create-payment.dto';
import { Repository } from 'typeorm';
import { PaymentConfig } from '../../entities/payment-config.entity';
import { PaymentItem } from '../../entities/payment-item.entity';
import { Payment } from '../../entities/payment.entity';
import { PaymentStatus } from '../../enum/payment-status.enum';

@Injectable()
export abstract class BasePaymentMethodService {
  protected readonly logger = new Logger(BasePaymentMethodService.name);
  protected readonly integrationClient: ClientProxy;

  constructor(
    @InjectRepository(Payment)
    protected readonly paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentConfig)
    protected readonly paymentConfigRepository: Repository<PaymentConfig>,
    @InjectRepository(PaymentItem)
    protected readonly paymentItemRepository: Repository<PaymentItem>,
  ) {
    this.integrationClient = ClientProxyFactory.create({
      transport: Transport.NATS,
      options: { servers: [envs.NATS_SERVERS] },
    });
  }

  abstract processPayment(data: CreatePaymentData): Promise<any>;

  /**
   * Valida que existe la configuración de pago
   */
  protected async validatePaymentConfig(code: string): Promise<PaymentConfig> {
    const paymentConfig = await this.paymentConfigRepository.findOne({
      where: { code },
    });

    if (!paymentConfig) {
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `Configuración de pago con código ${code} no encontrada`,
      });
    }

    return paymentConfig;
  }

  /**
   * Crea el registro de pago principal
   */
  protected async createPaymentRecord(
    data: CreatePaymentData,
    paymentConfig: PaymentConfig,
  ): Promise<Payment> {
    const payment = this.paymentRepository.create({
      userId: data.userId,
      userEmail: data.userEmail,
      userName: data.username,
      paymentConfig,
      amount: data.amount,
      status: data.status as PaymentStatus,
      paymentMethod: data.paymentMethod,
      relatedEntityType: data.relatedEntityType,
      relatedEntityId: String(data.relatedEntityId),
      metadata: data.metadata,
    });

    return await this.paymentRepository.save(payment);
  }

  /**
   * Sube archivo a AWS usando el microservicio de integración
   */
  protected async uploadFileToAWS(file: {
    originalname: string;
    buffer: Buffer;
  }): Promise<string> {
    try {
      const uploadData = {
        filename: file.originalname,
        buffer: file.buffer,
        folder: 'payments/vouchers',
      };

      const result = await firstValueFrom(
        this.integrationClient.send(
          { cmd: 'integration.uploadFile' },
          uploadData,
        ),
      );

      return result.url;
    } catch (error) {
      this.logger.error(`Error al subir archivo: ${error.message}`);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al subir archivo',
      });
    }
  }

  /**
   * Elimina registros en caso de error (rollback)
   */
  protected async rollbackPayment(paymentId: number): Promise<void> {
    try {
      await this.paymentItemRepository.delete({
        payment: { id: paymentId },
      });
      await this.paymentRepository.delete({ id: paymentId });
      this.logger.warn(`Rollback ejecutado para pago ${paymentId}`);
    } catch (error) {
      this.logger.error(`Error en rollback: ${error.message}`);
    }
  }

  async onModuleDestroy() {
    await this.integrationClient.close();
  }
}
