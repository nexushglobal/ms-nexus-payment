import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PaymentConfigMigrationData } from '../interfaces/payment-config.interfaces';
import { PaymentConfigMigrationService } from '../services/payment-config-migration.service';

interface PaymentConfigMigrationPayload {
  paymentConfigs: PaymentConfigMigrationData[];
}

@Controller()
export class PaymentConfigMigrationController {
  private readonly logger = new Logger(PaymentConfigMigrationController.name);

  constructor(
    private readonly paymentConfigMigrationService: PaymentConfigMigrationService,
  ) {}

  @MessagePattern({ cmd: 'payment.migrate.paymentConfigs' })
  async migratePaymentConfigs(
    @Payload() payload: PaymentConfigMigrationPayload,
  ) {
    this.logger.log(
      '📨 Solicitud de migración de configuraciones de pago recibida',
    );

    if (!payload.paymentConfigs || !Array.isArray(payload.paymentConfigs)) {
      throw new Error(
        'Faltan datos requeridos: paymentConfigs es obligatorio y debe ser un array',
      );
    }

    this.logger.log(
      `📊 Total de configuraciones de pago a migrar: ${payload.paymentConfigs.length}`,
    );

    const validation =
      this.paymentConfigMigrationService.validatePaymentConfigData(
        payload.paymentConfigs,
      );

    if (!validation.valid) {
      throw new Error(
        `Datos de configuraciones de pago inválidos: ${validation.errors.join(', ')}`,
      );
    }

    const result =
      await this.paymentConfigMigrationService.migratePaymentConfigs(
        payload.paymentConfigs,
      );

    return result;
  }
}
