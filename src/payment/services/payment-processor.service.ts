import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { CreatePaymentData } from '../dto/create-payment.dto';
import { PaymentMethod } from '../enum/patment-method';
import { PaymentGatewayService } from './payment-methods/payment-gateway.service';
import { PointsPaymentService } from './payment-methods/points-payment.service';
import { VoucherPaymentService } from './payment-methods/voucher-payment.service';

@Injectable()
export class PaymentProcessorService {
  private readonly logger = new Logger(PaymentProcessorService.name);

  constructor(
    private readonly voucherPaymentService: VoucherPaymentService,
    private readonly pointsPaymentService: PointsPaymentService,
    private readonly paymentGatewayService: PaymentGatewayService,
  ) {}

  async createPayment(data: CreatePaymentData): Promise<any> {
    this.logger.log(
      `Procesando pago para usuario ${data.userId} con método ${data.paymentMethod}`,
    );

    if (!Object.values(PaymentMethod).includes(data.paymentMethod)) {
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: 'Método de pago no válido',
      });
    }

    try {
      switch (data.paymentMethod) {
        case PaymentMethod.VOUCHER:
          return await this.voucherPaymentService.processPayment(data);

        case PaymentMethod.POINTS:
          return await this.pointsPaymentService.processPayment(data);

        case PaymentMethod.PAYMENT_GATEWAY:
          return await this.paymentGatewayService.processPayment(data);

        default:
          throw new RpcException({
            status: HttpStatus.BAD_REQUEST,
            message: 'Método de pago no soportado',
          });
      }
    } catch (error) {
      this.logger.error(`Error al procesar pago: ${error.message}`);
      throw error;
    }
  }
}
