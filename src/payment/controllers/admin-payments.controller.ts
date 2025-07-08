import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { GetAdminPaymentsDto } from '../dto/admin-payments.dto';
import { AdminPaymentsService } from '../services/admin-payment.service';
import { GetAdminPaymentDetailDto } from '../dto/admin-payment-detail.dto';
import { AdminPaymentDetailService } from '../services/admin-payment-detail.service';

@Controller()
export class AdminPaymentsController {
  constructor(
    private readonly adminPaymentsService: AdminPaymentsService,
    private readonly adminPaymentDetailService: AdminPaymentDetailService,
  ) {}

  @MessagePattern({ cmd: 'payment.admin.getAllPayments' })
  async getAllPayments(@Payload() dto: GetAdminPaymentsDto) {
    return await this.adminPaymentsService.getAllPayments(dto);
  }

  @MessagePattern({ cmd: 'payment.admin.getMetadata' })
  async getPaymentMetadata() {
    return await this.adminPaymentsService.getPaymentMetadata();
  }

  @MessagePattern({ cmd: 'payment.admin.getPaymentDetail' })
  async getPaymentDetail(@Payload() dto: GetAdminPaymentDetailDto) {
    return await this.adminPaymentDetailService.getPaymentDetail(dto);
  }
}
