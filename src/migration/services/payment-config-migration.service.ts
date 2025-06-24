import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentConfig } from 'src/payment/entities/payment-config.entity';
import { Repository } from 'typeorm';
import {
  PaymentConfigMigrationData,
  PaymentConfigMigrationResult,
} from '../interfaces/payment-config.interfaces';

@Injectable()
export class PaymentConfigMigrationService {
  private readonly logger = new Logger(PaymentConfigMigrationService.name);

  constructor(
    @InjectRepository(PaymentConfig)
    private paymentConfigRepository: Repository<PaymentConfig>,
  ) {}

  async migratePaymentConfigs(
    paymentConfigsData: PaymentConfigMigrationData[],
  ): Promise<PaymentConfigMigrationResult> {
    this.logger.log('🚀 Iniciando migración de configuraciones de pago...');

    const result: PaymentConfigMigrationResult = {
      success: true,
      message: '',
      details: {
        paymentConfigs: { total: 0, created: 0, skipped: 0, errors: [] },
      },
    };

    try {
      this.logger.log('💳 Migrando configuraciones de pago...');
      await this.createPaymentConfigs(
        paymentConfigsData,
        result.details.paymentConfigs,
      );

      result.message =
        'Migración de configuraciones de pago completada exitosamente';
      this.logger.log(
        '✅ Migración de configuraciones de pago completada exitosamente',
      );
    } catch (error) {
      result.success = false;
      result.message = `Error durante la migración de configuraciones de pago: ${error.message}`;
      this.logger.error(
        '❌ Error durante la migración de configuraciones de pago:',
        error,
      );
      throw error;
    }

    return result;
  }

  private async createPaymentConfigs(
    paymentConfigsData: PaymentConfigMigrationData[],
    details: any,
  ): Promise<void> {
    details.total = paymentConfigsData.length;

    for (const configData of paymentConfigsData) {
      try {
        // Verificar si la configuración ya existe por código
        const existingConfig = await this.paymentConfigRepository.findOne({
          where: { code: configData.code.toUpperCase().trim() },
        });

        if (existingConfig) {
          this.logger.warn(
            `⚠️ Configuración de pago ${configData.code} ya existe, saltando...`,
          );
          details.skipped++;
          continue;
        }

        // Crear nueva configuración de pago
        const newPaymentConfig = this.paymentConfigRepository.create({
          code: configData.code.toUpperCase().trim(),
          name:
            configData.name?.trim() ||
            this.generateNameFromCode(configData.code),
          description: configData.description?.trim() || undefined,
          isActive: true, // Por defecto activo
          createdAt: new Date(configData.createdAt),
          updatedAt: new Date(configData.updatedAt),
        });

        const savedConfig =
          await this.paymentConfigRepository.save(newPaymentConfig);
        details.created++;

        this.logger.log(
          `✅ Configuración de pago creada: ${configData.code} -> ID: ${savedConfig.id}`,
        );
      } catch (error) {
        const errorMsg = `Error creando configuración de pago ${configData.code}: ${error.message}`;
        details.errors.push(errorMsg);
        this.logger.error(`❌ ${errorMsg}`);
      }
    }
  }

  private generateNameFromCode(code: string): string {
    return code
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  validatePaymentConfigData(paymentConfigsData: any[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!Array.isArray(paymentConfigsData)) {
      errors.push('Los datos de configuraciones de pago deben ser un array');
      return { valid: false, errors };
    }

    paymentConfigsData.forEach((config, index) => {
      const requiredFields = ['id', 'code', 'createdAt', 'updatedAt'];

      for (const field of requiredFields) {
        if (
          !config[field] ||
          (typeof config[field] === 'string' && !config[field].trim())
        ) {
          errors.push(
            `Configuración de pago en índice ${index} falta el campo requerido: ${field}`,
          );
        }
      }

      if (config.code && typeof config.code === 'string') {
        const cleanCode = config.code.trim();
        if (!cleanCode) {
          errors.push(
            `Configuración de pago en índice ${index} tiene un código vacío`,
          );
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
