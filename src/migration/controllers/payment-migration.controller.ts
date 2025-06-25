import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PaymentMigrationData } from '../interfaces/payment.interfaces';
import { PaymentMigrationService } from '../services/payment-migration.service';

interface PaymentMigrationPayload {
  payments: PaymentMigrationData[];
}

@Controller()
export class PaymentMigrationController {
  private readonly logger = new Logger(PaymentMigrationController.name);

  constructor(
    private readonly paymentMigrationService: PaymentMigrationService,
  ) {}

  @MessagePattern({ cmd: 'payment.migrate.payments' })
  async migratePayments(@Payload() payload: PaymentMigrationPayload) {
    this.logger.log('📨 Solicitud de migración de pagos recibida');

    if (!payload.payments || !Array.isArray(payload.payments)) {
      throw new Error(
        'Faltan datos requeridos: payments es obligatorio y debe ser un array',
      );
    }

    this.logger.log(`📊 Total de pagos a migrar: ${payload.payments.length}`);

    const validation = this.paymentMigrationService.validatePaymentData(
      payload.payments,
    );

    if (!validation.valid) {
      throw new Error(
        `Datos de pagos inválidos: ${validation.errors.join(', ')}`,
      );
    }

    const result = await this.paymentMigrationService.migratePayments(
      payload.payments,
    );

    return result;
  }
}
