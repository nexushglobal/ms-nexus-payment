import { IsDateString, IsOptional } from 'class-validator';

export class GetPaymentsReportDto {
  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha de inicio debe estar en formato ISO 8601' },
  )
  startDate?: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha de fin debe estar en formato ISO 8601' },
  )
  endDate?: string;
}

export interface PaymentReportData {
  paymentAmount: number;
  paymentType: string;
  firstName: string;
  lastName: string;
  email: string;
  created: Date;
  paymentMethod: string;
}
