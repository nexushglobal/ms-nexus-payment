import { PaymentStatus } from '../enum/payment-status.enum';
import { PaymentMethod } from '../enum/patment-method';
import { PaymentItemType } from '../enum/payment-item.enum';

export interface PaymentItemResponse {
  id: number;
  itemType: PaymentItemType;
  url?: string;
  pointsTransactionId?: string;
  amount: number;
  bankName?: string;
  transactionDate?: Date;
}

export interface PaymentDetailResponse {
  id: number;
  amount: number;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  operationCode?: string;
  bankName?: string;
  operationDate?: Date;
  ticketNumber?: string;
  rejectionReason?: string;
  reviewedByEmail?: string;
  reviewedAt?: Date;
  isArchived: boolean;
  relatedEntityType?: string;
  relatedEntityId?: string;
  metadata?: Record<string, any>;
  externalReference?: string;
  gatewayTransactionId?: string;
  createdAt: Date;
  updatedAt: Date;
  paymentConfig: {
    id: number;
    code: string;
    name: string;
    description?: string;
  };
  items: PaymentItemResponse[];
}

export interface GetPaymentDetailParams {
  paymentId: number;
  userId: string;
}
