import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ChargeResponse,
  CreateChargeDto,
} from 'src/culqi/interfaces/charge.interface';
import { ChargeService } from 'src/culqi/services/charge.service';
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

    //ChargeService can be injected here if needed
    @Inject(ChargeService)
    private readonly chargeService: ChargeService,
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

      const culqiChargeData: CreateChargeDto = {
        amount: data.amount * 100, // Convertir a centavos
        userId: data.userId,
        userEmail: data.userEmail,
        sourceId: data.source_id,
        sourceType: 'card',
        currencyCode: 'PEN',
        capture: true,
        description: 'Pago realizado a través de PAYMENT_GATEWAY',
        metadata: {
          relatedEntityType: data.relatedEntityType,
          relatedEntityId: data.relatedEntityId,
          userId: data.userId,
          userEmail: data.userEmail,
          username: data.username,
          paymentMethod: data.paymentMethod,
          paymentId: payment.id,
        },
      };
      try {
        const culqiCharge = (await this.chargeService.createCharge(
          culqiChargeData,
        )) as ChargeResponse;
        payment.gatewayTransactionId = culqiCharge.culqiChargeId;
        await this.paymentRepository.save(payment);
      } catch (error) {
        this.logger.error(`Error al crear el cargo en Culqi: ${error.message}`);
        await this.rollbackPayment(payment.id);
        throw error;
      }

      const paymentItem = this.paymentItemRepository.create({
        payment: {
          id: payment.id,
        },
        itemType: PaymentItemType.PAYMENT_GATEWAY_TRANSACTION,
        paymentGatewayTransactionId: payment.gatewayTransactionId,
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
        gatewayTransactionId: payment.gatewayTransactionId,
        message: 'Pago creado exitosamente',
      };
    } catch (error) {
      this.logger.error(
        `Error al procesar pago PAYMENT_GATEWAY: ${error.message}`,
      );
      throw error;
    }
  }
}
