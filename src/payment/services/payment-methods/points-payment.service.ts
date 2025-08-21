import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreatePaymentData } from 'src/payment/dto/create-payment.dto';
import { Repository } from 'typeorm';
import { PaymentConfig } from '../../entities/payment-config.entity';
import { PaymentItem } from '../../entities/payment-item.entity';
import { Payment } from '../../entities/payment.entity';
import { BasePaymentMethodService } from './base-payment-method.service';

@Injectable()
export class PointsPaymentService extends BasePaymentMethodService {
  protected readonly logger = new Logger(PointsPaymentService.name);

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
    this.logger.log(`Procesando pago POINTS para usuario ${data.userId}`);

    // TODO: Implementar lógica para método POINTS
    return {
      success: false,
      message: 'Método POINTS no implementado aún',
    };
  }
}
