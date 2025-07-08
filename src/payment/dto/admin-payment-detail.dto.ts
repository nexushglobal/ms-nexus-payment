import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, Min } from 'class-validator';
import { PaymentStatus } from '../enum/payment-status.enum';
import { PaymentMethod } from '../enum/patment-method';
import { PaymentItemType } from '../enum/payment-item.enum';

export class GetAdminPaymentDetailDto {
  @IsNotEmpty({ message: 'El ID del pago es requerido' })
  @Type(() => Number)
  @IsNumber({}, { message: 'El ID del pago debe ser un número' })
  @Min(1, { message: 'El ID del pago debe ser mayor a 0' })
  paymentId: number;
}

export interface AdminPaymentItemResponse {
  id: number;
  itemType: PaymentItemType;
  url?: string;
  urlKey?: string;
  pointsTransactionId?: string;
  amount: number;
  bankName?: string;
  transactionDate?: Date;
}

export interface AdminPaymentDetailResponse {
  // Información básica del pago
  id: number;
  amount: number;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  rejectionReason?: string;
  reviewedAt?: Date;
  relatedEntityType?: string;
  relatedEntityId?: string;
  metadata?: Record<string, any>;
  gatewayTransactionId?: string;
  externalReference?: string;
  createdAt: Date;
  updatedAt: Date;
  billing: {
    operationCode?: string;
    bankName?: string;
    operationDate?: Date;
    ticketNumber?: string;
  };

  // Información del usuario
  user: {
    id: string;
    email: string;
    fullName: string;
    phone?: string;
    documentNumber?: string;
  };

  // Información de quien revisó (si aplica)
  reviewedBy?: {
    email: string;
  };

  // Configuración de pago
  paymentConfig: {
    id: number;
    code: string;
    name: string;
    description?: string;
  };

  // Items del pago
  items: AdminPaymentItemResponse[];
}
