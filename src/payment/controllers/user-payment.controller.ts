import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UserPaymentsService } from '../services/user-payment.service';
import { GetUserPaymentsPayload } from '../interfaces/user-payment.interface';

@Controller()
export class UserPaymentsController {
  constructor(private readonly userPaymentsService: UserPaymentsService) {}

  @MessagePattern({ cmd: 'payment.getUserPayments' })
  async getUserPayments(@Payload() data: GetUserPaymentsPayload) {
    return await this.userPaymentsService.getUserPayments(data);
  }

  @MessagePattern({ cmd: 'payment.getActivePaymentConfigs' })
  async getActivePaymentConfigs() {
    return await this.userPaymentsService.getActivePaymentConfigs();
  }
}
