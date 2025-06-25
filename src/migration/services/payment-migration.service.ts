import { Injectable, Logger } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { Payment } from 'src/payment/entities/payment.entity';
import { PaymentConfig } from 'src/payment/entities/payment-config.entity';
import { PaymentItem } from 'src/payment/entities/payment-item.entity';
import { PaymentStatus } from 'src/payment/enum/payment-status.enum';
import { PaymentMethod } from 'src/payment/enum/patment-method';
import { PaymentItemType } from 'src/payment/enum/payment-item.enum';
import { envs } from 'src/config/envs';
import {
  PaymentMigrationData,
  PaymentMigrationResult,
} from '../interfaces/payment.interfaces';

@Injectable()
export class PaymentMigrationService {
  private readonly logger = new Logger(PaymentMigrationService.name);
  private readonly usersClient: ClientProxy;

  // Mapeo de IDs antiguos a nuevos IDs
  private paymentIdMap = new Map<number, number>();
  private paymentConfigIdMap = new Map<number, number>();

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentConfig)
    private paymentConfigRepository: Repository<PaymentConfig>,
    @InjectRepository(PaymentItem)
    private paymentItemRepository: Repository<PaymentItem>,
  ) {
    this.usersClient = ClientProxyFactory.create({
      transport: Transport.NATS,
      options: {
        servers: [envs.NATS_SERVERS],
      },
    });
  }

  async migratePayments(
    paymentsData: PaymentMigrationData[],
  ): Promise<PaymentMigrationResult> {
    this.logger.log('🚀 Iniciando migración de pagos...');

    const result: PaymentMigrationResult = {
      success: true,
      message: '',
      details: {
        payments: { total: 0, created: 0, skipped: 0, errors: [] },
        paymentItems: { total: 0, created: 0, skipped: 0, errors: [] },
      },
    };

    try {
      // Limpiar mapeos anteriores
      this.paymentIdMap.clear();
      this.paymentConfigIdMap.clear();

      // Cargar mapeo de configuraciones de pago existentes
      await this.loadPaymentConfigMapping();

      // Paso 1: Crear pagos
      this.logger.log('💳 Creando pagos...');
      await this.createPayments(paymentsData, result.details.payments);

      // Paso 2: Crear items de pago
      this.logger.log('📄 Creando items de pago...');
      await this.createPaymentItems(paymentsData, result.details.paymentItems);

      result.message = 'Migración de pagos completada exitosamente';
      this.logger.log('✅ Migración de pagos completada exitosamente');
    } catch (error) {
      result.success = false;
      result.message = `Error durante la migración de pagos: ${error.message}`;
      this.logger.error('❌ Error durante la migración de pagos:', error);
      throw error;
    }

    return result;
  }

  private async loadPaymentConfigMapping(): Promise<void> {
    this.logger.log('📋 Cargando mapeo de configuraciones de pago...');

    const paymentConfigs = await this.paymentConfigRepository.find();

    // Crear mapeo basado en el ID del paymentConfig de la data de migración
    for (const config of paymentConfigs) {
      this.paymentConfigIdMap.set(config.id, config.id);
    }

    this.logger.log(
      `✅ Cargadas ${paymentConfigs.length} configuraciones de pago`,
    );
  }

  private async createPayments(
    paymentsData: PaymentMigrationData[],
    details: any,
  ): Promise<void> {
    details.total = paymentsData.length;

    for (const paymentData of paymentsData) {
      try {
        // Buscar información del usuario por email
        const userInfo = await this.getUserByEmail(
          paymentData.userEmail.trim(),
        );

        if (!userInfo) {
          const errorMsg = `Usuario no encontrado: ${paymentData.userEmail}`;
          details.errors.push(errorMsg);
          this.logger.warn(`⚠️ ${errorMsg}`);
          continue;
        }

        // Verificar si el pago ya existe
        const existingPayment = await this.paymentRepository.findOne({
          where: {
            userId: userInfo.id,
            paymentConfig: { id: paymentData.paymentConfigId },
            amount: paymentData.amount,
            createdAt: new Date(paymentData.createdAt),
          },
          relations: ['paymentConfig'],
        });

        if (existingPayment) {
          this.logger.warn(
            `⚠️ Pago para usuario ${paymentData.userEmail} con monto ${paymentData.amount} ya existe, saltando...`,
          );
          this.paymentIdMap.set(paymentData.id, existingPayment.id);
          details.skipped++;
          continue;
        }

        // Verificar que la configuración de pago exista
        const paymentConfig = await this.paymentConfigRepository.findOne({
          where: { id: paymentData.paymentConfigId },
        });

        if (!paymentConfig) {
          throw new Error(
            `Configuración de pago con ID ${paymentData.paymentConfigId} no encontrada`,
          );
        }

        // Buscar información del reviewer si existe
        let reviewerInfo: {
          id: string;
          email: string;
          fullName: string;
        } | null = null;
        if (paymentData.reviewedByEmail) {
          reviewerInfo = await this.getUserByEmail(
            paymentData.reviewedByEmail.trim(),
          );
          if (!reviewerInfo) {
            this.logger.warn(
              `⚠️ Usuario reviewer no encontrado: ${paymentData.reviewedByEmail}`,
            );
          }
        }

        // Crear nuevo pago
        const newPayment = this.paymentRepository.create({
          userId: userInfo.id,
          userEmail: userInfo.email,
          userName: userInfo.fullName,
          paymentConfig: paymentConfig,
          amount: Number(paymentData.amount),
          status: this.mapPaymentStatus(paymentData.status),
          paymentMethod: this.mapPaymentMethod(paymentData.paymentMethod),
          operationCode: paymentData.operationCode?.trim() || undefined,
          bankName: undefined,
          operationDate: undefined, // Se llenará desde los items si es necesario
          ticketNumber: paymentData.ticketNumber?.trim() || undefined,
          rejectionReason: paymentData.rejectionReason?.trim() || undefined,
          reviewedById: reviewerInfo?.id || undefined,
          reviewedByEmail: reviewerInfo?.email || undefined,
          reviewedAt: paymentData.reviewedAt
            ? new Date(paymentData.reviewedAt)
            : undefined,
          isArchived: Boolean(paymentData.isArchived),
          relatedEntityType: paymentData.relatedEntityType?.trim() || undefined,
          relatedEntityId: paymentData.relatedEntityId?.toString() || undefined,
          metadata: paymentData.metadata || {},
          createdAt: new Date(paymentData.createdAt),
          updatedAt: new Date(paymentData.updatedAt),
        });

        const savedPaymentResult =
          await this.paymentRepository.save(newPayment);
        const savedPayment = Array.isArray(savedPaymentResult)
          ? savedPaymentResult[0]
          : savedPaymentResult;
        this.paymentIdMap.set(paymentData.id, savedPayment.id as number);
        details.created++;

        this.logger.log(
          `✅ Pago creado: ${paymentData.userEmail} (${paymentData.amount}) -> ID: ${savedPayment.id}`,
        );
      } catch (error) {
        const errorMsg = `Error creando pago para ${paymentData.userEmail}: ${error.message}`;
        details.errors.push(errorMsg);
        this.logger.error(`❌ ${errorMsg}`);
      }
    }
  }

  private async createPaymentItems(
    paymentsData: PaymentMigrationData[],
    details: any,
  ): Promise<void> {
    // Contar total de items
    details.total = paymentsData.reduce(
      (total, payment) => total + (payment.items?.length || 0),
      0,
    );

    for (const paymentData of paymentsData) {
      if (!paymentData.items || paymentData.items.length === 0) {
        continue;
      }

      const paymentId = this.paymentIdMap.get(paymentData.id);
      if (!paymentId) {
        const errorMsg = `Pago ${paymentData.id} no encontrado para crear items`;
        details.errors.push(errorMsg);
        this.logger.error(`❌ ${errorMsg}`);
        continue;
      }

      const payment = await this.paymentRepository.findOne({
        where: { id: paymentId },
      });

      if (!payment) {
        continue;
      }

      for (const itemData of paymentData.items) {
        try {
          // Verificar si el item ya existe
          const existingItem = await this.paymentItemRepository.findOne({
            where: {
              payment: { id: paymentId },
              amount: Number(itemData.amount),
              transactionDate: new Date(itemData.transactionDate),
            },
          });

          if (existingItem) {
            this.logger.warn(
              `⚠️ Item ya existe para pago ${paymentId}, saltando...`,
            );
            details.skipped++;
            continue;
          }

          // Determinar el tipo de item
          const itemType = this.determineItemType(
            itemData,
            paymentData.paymentMethod,
          );

          const newItem = this.paymentItemRepository.create({
            payment: payment,
            itemType: itemType,
            url: itemData.url?.trim() || undefined,
            urlKey: undefined, // No viene en la data original
            pointsTransactionId:
              itemData.transactionReference?.trim() || undefined,
            amount: Number(itemData.amount),
            bankName: itemData.bankName?.trim() || undefined,
            transactionDate: new Date(itemData.transactionDate),
          });

          const savedItemResult =
            await this.paymentItemRepository.save(newItem);
          const savedItem = Array.isArray(savedItemResult)
            ? savedItemResult[0]
            : savedItemResult;
          details.created++;

          this.logger.log(
            `✅ Item creado para pago ${paymentId}: ${itemData.amount} -> ID: ${savedItem.id}`,
          );
        } catch (error) {
          const errorMsg = `Error creando item para pago ${paymentId}: ${error.message}`;
          details.errors.push(errorMsg);
          this.logger.error(`❌ ${errorMsg}`);
        }
      }
    }
  }

  private async getUserByEmail(email: string): Promise<{
    id: string;
    email: string;
    fullName: string;
  } | null> {
    try {
      const user = await firstValueFrom(
        this.usersClient.send(
          { cmd: 'user.findByEmailMS' },
          { email: email.toLowerCase().trim() },
        ),
      );

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      };
    } catch (error) {
      this.logger.error(`Error buscando usuario por email ${email}:`, error);
      return null;
    }
  }

  private mapPaymentStatus(status: string): PaymentStatus {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return PaymentStatus.PENDING;
      case 'APPROVED':
        return PaymentStatus.APPROVED;
      case 'REJECTED':
        return PaymentStatus.REJECTED;
      case 'COMPLETED':
        return PaymentStatus.COMPLETED;
      default:
        return PaymentStatus.PENDING;
    }
  }

  private mapPaymentMethod(method: string): PaymentMethod {
    switch (method.toUpperCase()) {
      case 'VOUCHER':
        return PaymentMethod.VOUCHER;
      case 'POINTS':
        return PaymentMethod.POINTS;
      case 'PAYMENT_GATEWAY':
        return PaymentMethod.PAYMENT_GATEWAY;
      default:
        return PaymentMethod.VOUCHER;
    }
  }

  private determineItemType(
    itemData: any,
    paymentMethod: string,
  ): PaymentItemType {
    // Si es pago con puntos o tiene referencia de transacción de puntos
    if (
      paymentMethod === 'POINTS' ||
      (itemData.transactionReference &&
        itemData.transactionReference.includes('Puntos'))
    ) {
      return PaymentItemType.POINTS_TRANSACTION;
    }

    // Por defecto, es imagen de voucher
    return PaymentItemType.VOUCHER_IMAGE;
  }

  validatePaymentData(paymentsData: any[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!Array.isArray(paymentsData)) {
      errors.push('Los datos de pagos deben ser un array');
      return { valid: false, errors };
    }

    paymentsData.forEach((payment, index) => {
      // Validar campos requeridos
      const requiredFields = [
        'id',
        'userEmail',
        'paymentConfigId',
        'amount',
        'status',
        'paymentMethod',
        'isArchived',
        'createdAt',
        'updatedAt',
      ];

      for (const field of requiredFields) {
        if (payment[field] === undefined || payment[field] === null) {
          errors.push(
            `Pago en índice ${index} falta el campo requerido: ${field}`,
          );
        }
      }

      // Validar valores numéricos
      if (payment.amount !== undefined) {
        const amount = Number(payment.amount);
        if (isNaN(amount) || amount <= 0) {
          errors.push(
            `Pago en índice ${index} tiene un monto inválido: ${payment.amount}`,
          );
        }
      }

      if (payment.paymentConfigId !== undefined) {
        const configId = Number(payment.paymentConfigId);
        if (isNaN(configId) || configId <= 0) {
          errors.push(
            `Pago en índice ${index} tiene un paymentConfigId inválido: ${payment.paymentConfigId}`,
          );
        }
      }

      // Validar status

      // Validar items si existen
      if (payment.items && Array.isArray(payment.items)) {
        payment.items.forEach((item: any, itemIndex: number) => {
          const requiredItemFields = [
            'id',
            'amount',
            'transactionDate',
            'isActive',
            'createdAt',
            'updatedAt',
          ];

          for (const field of requiredItemFields) {
            if (item[field] === undefined || item[field] === null) {
              errors.push(
                `Item ${itemIndex} en pago ${index} falta el campo requerido: ${field}`,
              );
            }
          }

          // Validar monto del item
          if (item.amount !== undefined) {
            const itemAmount = Number(item.amount);
            if (isNaN(itemAmount) || itemAmount <= 0) {
              errors.push(
                `Item ${itemIndex} en pago ${index} tiene un monto inválido: ${item.amount}`,
              );
            }
          }

          // Validar fecha de transacción
        });
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    return emailRegex.test(email);
  }

  async onModuleDestroy() {
    await this.usersClient.close();
  }
}
