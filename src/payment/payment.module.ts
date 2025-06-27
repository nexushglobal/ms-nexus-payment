import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from './controllers/payment.controller';
import { UserPaymentsController } from './controllers/user-payment.controller';
import { PaymentConfig } from './entities/payment-config.entity';
import { PaymentItem } from './entities/payment-item.entity';
import { Payment } from './entities/payment.entity';
import { PaymentService } from './services/payment.service';
import { UserPaymentsService } from './services/user-payment.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, PaymentConfig, PaymentItem])],
  controllers: [PaymentController, UserPaymentsController],
  providers: [PaymentService, UserPaymentsService],
  exports: [TypeOrmModule, PaymentService, UserPaymentsService],
})
export class PaymentModule {}
