import {
  FindOneWithdrawalResponseDto,
  WithdrawalPointDto,
} from './find-one-withdrawal.dto';

export class PaymentInfoDto {
  paymentId: string;
  operationCode: string | null;
  ticketNumber: string | null;
  paymentMethod: string; // Enum PaymentMethod como string
  amount: number;
}

// DTO extendido para withdrawal points con información de pagos
export class WithdrawalPointWithReportDto extends WithdrawalPointDto {
  paymentsInfo: PaymentInfoDto[];
}

// DTO extendido para la respuesta completa del reporte
export interface FindOneWithdrawalWithReportResponseDto
  extends Omit<FindOneWithdrawalResponseDto, 'withdrawalPoints'> {
  withdrawalPoints: WithdrawalPointWithReportDto[];
}
