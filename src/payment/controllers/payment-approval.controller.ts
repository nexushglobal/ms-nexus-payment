import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  ApprovePaymentDto,
  CompletePaymentDto,
  RejectPaymentDto,
} from '../dto/approve-payment.dto';
import { PaymentApprovalService } from '../services/payment-approval.service';

@Controller()
export class PaymentApprovalController {
  private readonly logger = new Logger(PaymentApprovalController.name);

  constructor(
    private readonly paymentApprovalService: PaymentApprovalService,
  ) {}

  @MessagePattern({ cmd: 'payment.approve' })
  async approvePayment(
    @Payload()
    data: {
      id: number;
      userId: string;
      approvePaymentDto: ApprovePaymentDto;
    },
  ) {
    this.logger.log(`Procesando aprobación de pago ID: ${data.id}`);

    return await this.paymentApprovalService.approvePayment(
      data.id,
      data.userId,
      data.approvePaymentDto,
    );
  }

  @MessagePattern({ cmd: 'payment.reject' })
  async rejectPayment(
    @Payload()
    data: {
      id: number;
      userId: string;
      rejectPaymentDto: RejectPaymentDto;
    },
  ) {
    this.logger.log(`Procesando rechazo de pago ID: ${data.id}`);

    return await this.paymentApprovalService.rejectPayment(
      data.id,
      data.userId,
      data.rejectPaymentDto,
    );
  }
  @MessagePattern({ cmd: 'payment.complete' })
  async completePayment(
    @Payload()
    data: {
      id: number;
      userId: string;
      completePaymentDto: CompletePaymentDto;
    },
  ) {
    this.logger.log(`Procesando completado de pago ID: ${data.id}`);
    return await this.paymentApprovalService.completePayment(
      data.id,
      data.userId,
      data.completePaymentDto,
    );
  }
}
