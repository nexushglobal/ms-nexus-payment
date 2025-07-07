import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PaymentDetailService } from '../services/payment-detail.service';
import { GetPaymentDetailParams } from '../interfaces/payment-detail.interface';

@Controller()
export class PaymentDetailController {
  constructor(private readonly paymentDetailService: PaymentDetailService) {}

  @MessagePattern({ cmd: 'payment.getPaymentDetail' })
  async getPaymentDetail(@Payload() data: GetPaymentDetailParams) {
    return await this.paymentDetailService.getPaymentDetail(data);
  }
}
