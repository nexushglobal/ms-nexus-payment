import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { GenerateLiquidationDto } from './dto/generate-liquidation.dto';
import { ReportsWithdrawalService } from './reports-withdrawal.service';

@Controller()
export class ReportsWithdrawalController {
  constructor(
    private readonly reportsWithdrawalService: ReportsWithdrawalService,
  ) {}

  @MessagePattern({ cmd: 'reportsWithdrawal.generateLiquidation' })
  async generateLiquidation(@Payload() data: GenerateLiquidationDto) {
    const { withdrawalId, userDocumentNumber, userRazonSocial } = data;
    return await this.reportsWithdrawalService.generateLiquidation(
      withdrawalId,
      userDocumentNumber,
      userRazonSocial,
    );
  }
}
