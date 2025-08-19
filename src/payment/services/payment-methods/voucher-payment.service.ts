import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { CreatePaymentData } from 'src/payment/dto/create-payment.dto';
import { Repository } from 'typeorm';
import { PaymentConfig } from '../../entities/payment-config.entity';
import { PaymentItem } from '../../entities/payment-item.entity';
import { Payment } from '../../entities/payment.entity';
import { PaymentItemType } from '../../enum/payment-item.enum';
import { BasePaymentMethodService } from './base-payment-method.service';

@Injectable()
export class VoucherPaymentService extends BasePaymentMethodService {
  protected readonly logger = new Logger(VoucherPaymentService.name);

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
    this.logger.log(`Procesando pago VOUCHER para usuario ${data.userId}`);

    try {
      const paymentConfig = await this.validatePaymentConfig(
        data.paymentConfig,
      );

      if (!data.files || data.files.length === 0) {
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message: 'Se requiere al menos un archivo para el método VOUCHER',
        });
      }

      if (!data.payments || data.payments.length === 0) {
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message:
            'Se requiere al menos un detalle de pago para el método VOUCHER',
        });
      }

      const payment = await this.createPaymentRecord(data, paymentConfig);

      const paymentItems: PaymentItem[] = [];

      for (const paymentDetail of data.payments) {
        try {
          if (paymentDetail.fileIndex >= data.files.length) {
            throw new RpcException({
              status: HttpStatus.BAD_REQUEST,
              message: `Índice de archivo ${paymentDetail.fileIndex} no válido`,
            });
          }

          const file = data.files[paymentDetail.fileIndex];

          const imageUrl = await this.uploadFileToAWS({
            originalname: file.originalname,
            buffer: file.buffer,
            mimetype: file.mimetype,
            size: file.size,
          });

          const paymentItem = this.paymentItemRepository.create({
            payment: {
              id: payment.id,
            },
            itemType: PaymentItemType.VOUCHER_IMAGE,
            url: imageUrl,
            amount: paymentDetail.amount,
            bankName: paymentDetail.bankName,
            transactionDate: new Date(paymentDetail.transactionDate as string),
          });

          const savedItem = await this.paymentItemRepository.save(paymentItem);
          paymentItems.push(savedItem);
        } catch (itemError) {
          this.logger.error(
            `Error al procesar item de pago: ${itemError.message}`,
          );
          await this.rollbackPayment(payment.id);
          throw itemError;
        }
      }

      this.logger.log(
        `Pago VOUCHER creado exitosamente para usuario ${data.userId}`,
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
