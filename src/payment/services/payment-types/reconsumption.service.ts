import { Injectable, Logger } from '@nestjs/common';
import { Payment } from '../../entities/payment.entity';

@Injectable()
export class ReconsumptionService {
  private readonly logger = new Logger(ReconsumptionService.name);

  async processReconsumptionPayment(payment: Payment): Promise<void> {
    this.logger.log(
      `Procesamiento de RECONSUMPTION pendiente para payment ID: ${payment.id}`,
    );
    // TODO: Implementar lógica de reconsumo en el futuro
    return Promise.resolve();
  }

  async processReconsumptionRejection(payment: Payment): Promise<void> {
    this.logger.log('Reconsumption rejection - To be implemented', payment);
    // TODO: Implementar en el futuro
    return Promise.resolve();
  }
}
