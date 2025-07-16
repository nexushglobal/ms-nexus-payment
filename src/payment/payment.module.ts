import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from './controllers/payment.controller';
import { UserPaymentsController } from './controllers/user-payment.controller';
import { PaymentConfig } from './entities/payment-config.entity';
import { PaymentItem } from './entities/payment-item.entity';
import { Payment } from './entities/payment.entity';
import { PaymentService } from './services/payment.service';
import { UserPaymentsService } from './services/user-payment.service';
import { PaymentDetailController } from './controllers/payment-detail.controller';
import { PaymentDetailService } from './services/payment-detail.service';
import { AdminPaymentsService } from './services/admin-payment.service';
import { AdminPaymentsController } from './controllers/admin-payments.controller';
import { PaymentProcessorService } from './services/payment-processor.service';
import { VoucherPaymentService } from './services/payment-methods/voucher-payment.service';
import { PointsPaymentService } from './services/payment-methods/points-payment.service';
import { PaymentGatewayService } from './services/payment-methods/payment-gateway.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, PaymentConfig, PaymentItem])],
  controllers: [
    PaymentController,
    UserPaymentsController,
    PaymentDetailController,
    AdminPaymentsController,
  ],
  providers: [
    PaymentService,
    UserPaymentsService,
    PaymentDetailService,
    AdminPaymentsService,
    PaymentProcessorService,
    VoucherPaymentService,
    PointsPaymentService,
    PaymentGatewayService,
  ],
  exports: [
    TypeOrmModule,
    PaymentService,
    UserPaymentsService,
    PaymentDetailService,
    AdminPaymentsService,
    PaymentProcessorService,
  ],
})
export class PaymentModule {}
