import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ApproveWithdrawalDto } from './dto/approve-withdrawal.dto';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { FindWithdrawalsDto } from './dto/find-withdrawals.dto';
import { RejectWithdrawalDto } from './dto/reject-withdrawal.dto';
import { WithdrawalsService } from './withdrawals.service';

@Controller()
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  @MessagePattern({ cmd: 'withdrawals.create' })
  async createWithdrawal(@Payload() data: CreateWithdrawalDto) {
    return await this.withdrawalsService.createWithdrawal(data);
  }

  @MessagePattern({ cmd: 'withdrawals.findAll' })
  async findAllWithdrawals(@Payload() data: FindWithdrawalsDto) {
    return await this.withdrawalsService.findAllWithdrawals(data);
  }

  @MessagePattern({ cmd: 'withdrawals.findOne' })
  async findOneWithdrawal(@Payload() data: { id: number }) {
    return await this.withdrawalsService.findOneWithdrawal(data.id);
  }

  @MessagePattern({ cmd: 'withdrawals.findUserWithdrawals' })
  async findUserWithdrawals(
    @Payload('userId') userId: string,
    @Payload('filters') data: FindWithdrawalsDto,
  ) {
    return await this.withdrawalsService.findUserWithdrawals(userId, data);
  }

  @MessagePattern({ cmd: 'withdrawals.approve' })
  async approveWithdrawal(
    @Payload() approveWithdrawalDto: ApproveWithdrawalDto,
  ) {
    return await this.withdrawalsService.approveWithdrawal(
      approveWithdrawalDto.withdrawalId,
      approveWithdrawalDto.reviewerId,
      approveWithdrawalDto.reviewerEmail,
    );
  }

  @MessagePattern({ cmd: 'withdrawals.reject' })
  async RejectWithdrawalDto(
    @Payload() rejectWithdrawalDto: RejectWithdrawalDto,
  ) {
    return await this.withdrawalsService.rejectWithdrawal(
      rejectWithdrawalDto.withdrawalId,
      rejectWithdrawalDto.reviewerId,
      rejectWithdrawalDto.reviewerEmail,
      rejectWithdrawalDto.rejectionReason,
    );
  }
}
