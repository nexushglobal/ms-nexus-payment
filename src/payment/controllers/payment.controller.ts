import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreatePaymentData } from '../dto/create-payment.dto';
import { GetPaymentsReportDto } from '../dto/get-payments-report.dto';
import { PaymentProcessorService } from '../services/payment-processor.service';
import { PaymentService } from '../services/payment.service';

@Controller()
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly paymentProcessorService: PaymentProcessorService,
  ) {}

  @MessagePattern({ cmd: 'payment.findById' })
  async findById(@Payload() data: { id: number }) {
    return await this.paymentService.findById(data.id);
  }

  @MessagePattern({ cmd: 'payment.findByIds' })
  async findByIds(@Payload() data: { ids: number[] }) {
    return await this.paymentService.findByIds(data.ids);
  }

  @MessagePattern({ cmd: 'payment.createPayment' })
  async createPayment(@Payload() data: CreatePaymentData) {
    return await this.paymentProcessorService.createPayment(data);
  }

  @MessagePattern({ cmd: 'payment.getPaymentsReport' })
  async getPaymentsReport(@Payload() data: GetPaymentsReportDto) {
    return await this.paymentService.getPaymentsReport(
      data.startDate,
      data.endDate,
    );
  }
}
