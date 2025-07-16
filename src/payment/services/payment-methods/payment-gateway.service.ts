import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BasePaymentMethodService } from './base-payment-method.service';
import { Payment } from '../../entities/payment.entity';
import { PaymentConfig } from '../../entities/payment-config.entity';
import { PaymentItem } from '../../entities/payment-item.entity';
import { CreatePaymentData } from 'src/payment/dto/create-payment.dto';

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

    // TODO: Implementar lógica para método PAYMENT_GATEWAY
    return {
      success: false,
      message: 'Método PAYMENT_GATEWAY no implementado aún',
    };
  }
}
