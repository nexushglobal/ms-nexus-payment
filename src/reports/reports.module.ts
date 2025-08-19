import { Module } from '@nestjs/common';
import { PrinterModule } from './printer/printer.module';
import { ReportsWithdrawalModule } from './reports-withdrawal/reports-withdrawal.module';

@Module({
  imports: [ReportsWithdrawalModule, PrinterModule],
})
export class ReportsModule {}
