import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PaymentService } from '../services/payment.service';

@Controller()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @MessagePattern({ cmd: 'payment.findById' })
  async findById(@Payload() data: { id: number }) {
    return await this.paymentService.findById(data.id);
  }

  @MessagePattern({ cmd: 'payment.findByIds' })
  async findByIds(@Payload() data: { ids: number[] }) {
    return await this.paymentService.findByIds(data.ids);
  }
}
