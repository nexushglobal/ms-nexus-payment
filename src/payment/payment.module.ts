import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CulqiModule } from 'src/culqi/culqi.module';
import { AdminPaymentsController } from './controllers/admin-payments.controller';
import { PaymentApprovalController } from './controllers/payment-approval.controller';
import { PaymentDetailController } from './controllers/payment-detail.controller';
import { PaymentController } from './controllers/payment.controller';
import { UserPaymentsController } from './controllers/user-payment.controller';
import { PaymentConfig } from './entities/payment-config.entity';
import { PaymentItem } from './entities/payment-item.entity';
import { Payment } from './entities/payment.entity';
import { AdminPaymentsService } from './services/admin-payment.service';
import { PaymentApprovalService } from './services/payment-approval.service';
import { PaymentDetailService } from './services/payment-detail.service';
import { PaymentGatewayService } from './services/payment-methods/payment-gateway.service';
import { PointsPaymentService } from './services/payment-methods/points-payment.service';
import { VoucherPaymentService } from './services/payment-methods/voucher-payment.service';
import { PaymentProcessorService } from './services/payment-processor.service';
import { MembershipPaymentService } from './services/payment-types/membership-payment.service';
import { OrderPaymentService } from './services/payment-types/order-payment.service';
import { PlanUpgradeService } from './services/payment-types/plan-upgrade.service';
import { ReconsumptionService } from './services/payment-types/reconsumption.service';
import { PaymentService } from './services/payment.service';
import { UserPaymentsService } from './services/user-payment.service';
import { UserService } from './services/user/user.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, PaymentConfig, PaymentItem]),
    CulqiModule,
  ],
  controllers: [
    PaymentController,
    UserPaymentsController,
    PaymentDetailController,
    AdminPaymentsController,
    PaymentApprovalController,
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

    PaymentApprovalService,
    PlanUpgradeService,
    ReconsumptionService,
    MembershipPaymentService,
    OrderPaymentService,
    UserService,
  ],
  exports: [
    TypeOrmModule,
    PaymentService,
    UserPaymentsService,
    PaymentDetailService,
    AdminPaymentsService,
    PaymentApprovalService,
    PlanUpgradeService,
    ReconsumptionService,
    MembershipPaymentService,
    OrderPaymentService,
    UserService,
    PaymentProcessorService,
  ],
})
export class PaymentModule {}
