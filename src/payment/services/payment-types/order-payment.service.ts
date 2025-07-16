import { Injectable, Logger } from '@nestjs/common';
import { Payment } from '../../entities/payment.entity';

@Injectable()
export class OrderPaymentService {
  private readonly logger = new Logger(OrderPaymentService.name);

  async processOrderPayment(payment: Payment): Promise<void> {
    this.logger.log(
      `Procesamiento de ORDER_PAYMENT pendiente para payment ID: ${payment.id}`,
    );

    // TODO: Implementar lógica de pago de órdenes en el futuro
    // Por ahora solo registramos que se procesó
  }
}
