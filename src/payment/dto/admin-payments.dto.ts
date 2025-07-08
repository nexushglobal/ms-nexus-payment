import { Transform, Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  IsDateString,
  IsIn,
} from 'class-validator';
import { PaymentStatus } from '../enum/payment-status.enum';
import { PaymentMethod } from '../enum/patment-method';

export class GetAdminPaymentsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página debe ser mayor a 0' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite debe ser mayor a 0' })
  limit?: number = 20;

  @IsOptional()
  @IsString({ message: 'La búsqueda debe ser texto' })
  @Transform(({ value }) => value?.trim())
  search?: string;

  @IsOptional()
  @IsIn(Object.values(PaymentStatus), {
    message: `El estado debe ser uno de: ${Object.values(PaymentStatus).join(', ')}`,
  })
  status?: PaymentStatus;

  @IsOptional()
  @IsIn(Object.values(PaymentMethod), {
    message: `El método de pago debe ser uno de: ${Object.values(PaymentMethod).join(', ')}`,
  })
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha de inicio debe tener formato válido YYYY-MM-DD' },
  )
  startDate?: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha de fin debe tener formato válido YYYY-MM-DD' },
  )
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La configuración de pago debe ser un número entero' })
  @Min(1, { message: 'La configuración de pago debe ser mayor a 0' })
  paymentConfigId?: number;
}

export interface AdminPaymentResponse {
  id: number;
  amount: number;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  operationCode?: string;
  ticketNumber?: string;
  createdAt: Date;
  reviewedAt?: Date;
  reviewedByEmail?: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    documentNumber?: string;
  };
  paymentConfig: {
    id: number;
    name: string;
    code: string;
  };
}

export interface AdminPaymentsResponse {
  payments: AdminPaymentResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaymentMetadataResponse {
  paymentMethods: Array<{
    value: string;
    label: string;
  }>;
  paymentStatuses: Array<{
    value: string;
    label: string;
  }>;
  paymentConfigs: Array<{
    id: number;
    name: string;
    code: string;
  }>;
}
