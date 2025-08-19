import { forwardRef, Module } from '@nestjs/common';
import { CommonModule } from 'src/common/common.module';
import { WithdrawalsModule } from 'src/withdrawals/withdrawals.module';
import { PrinterModule } from '../printer/printer.module';
import { ReportsWithdrawalController } from './reports-withdrawal.controller';
import { ReportsWithdrawalService } from './reports-withdrawal.service';

@Module({
  imports: [PrinterModule, forwardRef(() => WithdrawalsModule), CommonModule],
  controllers: [ReportsWithdrawalController],
  providers: [ReportsWithdrawalService],
  exports: [ReportsWithdrawalService],
})
export class ReportsWithdrawalModule {}
