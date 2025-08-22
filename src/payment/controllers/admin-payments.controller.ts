import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { GetAdminPaymentsDto } from '../dto/admin-payments.dto';
import { AdminPaymentsService } from '../services/admin-payment.service';
import { PaymentDetailService } from '../services/payment-detail.service';

@Controller()
export class AdminPaymentsController {
  constructor(
    private readonly adminPaymentsService: AdminPaymentsService,
    private readonly paymentDetailService: PaymentDetailService,
  ) {}

  @MessagePattern({ cmd: 'payment.admin.getAllPayments' })
  async getAllPayments(@Payload() dto: GetAdminPaymentsDto) {
    return await this.adminPaymentsService.getAllPayments(dto);
  }

  @MessagePattern({ cmd: 'payment.admin.getPaymentDetail' })
  async getPaymentDetail(@Payload() dto: { paymentId: number }) {
    return await this.paymentDetailService.getPaymentDetail({
      paymentId: dto.paymentId,
      isAdmin: true,
    });
  }
}
