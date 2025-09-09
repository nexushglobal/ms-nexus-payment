import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from 'src/common/common.module';
import { PaymentModule } from 'src/payment/payment.module';
import { ReportsWithdrawalModule } from 'src/reports/reports-withdrawal/reports-withdrawal.module';
import { WithdrawalPoints } from './entities/wirhdrawal-points.entity';
import { Withdrawal } from './entities/withdrawal.entity';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsService } from './withdrawals.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Withdrawal, WithdrawalPoints]),
    CommonModule,
    forwardRef(() => PaymentModule),
    forwardRef(() => ReportsWithdrawalModule),
  ],
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
