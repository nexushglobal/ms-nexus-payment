import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreatePaymentData } from 'src/payment/dto/create-payment.dto';
import { PaymentItemType } from 'src/payment/enum/payment-item.enum';
import { Repository } from 'typeorm';
import { PaymentConfig } from '../../entities/payment-config.entity';
import { PaymentItem } from '../../entities/payment-item.entity';
import { Payment } from '../../entities/payment.entity';
import { BasePaymentMethodService } from './base-payment-method.service';

@Injectable()
export class PaymentGatewayService extends BasePaymentMethodService {
  protected readonly logger = new Logger(PaymentGatewayService.name);

  constructor(
    @InjectRepository(Payment)
    paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentConfig)
    paymentConfigRepository: Repository<PaymentConfig>,
    @InjectRepository(PaymentItem)
    paymentItemRepository: Repository<PaymentItem>,
  ) {
    super(paymentRepository, paymentConfigRepository, paymentItemRepository);
  }

  async processPayment(data: CreatePaymentData): Promise<any> {
    this.logger.log(
      `Procesando pago PAYMENT_GATEWAY para usuario ${data.userId}`,
    );
    try {
      const paymentConfig = await this.validatePaymentConfig(
        data.paymentConfig,
      );

      const payment = await this.createPaymentRecord(data, paymentConfig);

      const paymentItem = this.paymentItemRepository.create({
        payment: {
          id: payment.id,
        },
        itemType: PaymentItemType.PAYMENT_GATEWAY_TRANSACTION,
        amount: data.amount,
        bankName: 'Culqi',
        transactionDate: new Date(),
      });

      await this.paymentItemRepository.save(paymentItem);

      this.logger.log(
        `Pago PAYMENT_GATEWAY creado exitosamente para usuario ${data.userId}`,
      );

      return {
        success: true,
        paymentId: payment.id,

        message: 'Pago creado exitosamente',
      };
    } catch (error) {
      this.logger.error(`Error al procesar pago VOUCHER: ${error.message}`);
      throw error;
    }
  }
}
