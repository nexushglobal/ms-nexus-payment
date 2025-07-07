import { PaymentStatus } from '../enum/payment-status.enum';

export interface PaymentResponse {
  id: number;
  amount: number;
  status: PaymentStatus;
  paymentMethod: string;
  createdAt: Date;
  updatedAt: Date;
  paymentConfig: {
    name: string;
  };
}

export interface GetUserPaymentsParams {
  userId: string;
  limit: number;
  offset: number;
  filters: {
    search?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
    startDate?: string;
    endDate?: string;
    status?: string;
    paymentConfigId?: number;
  };
}

export interface GetUserPaymentsPayload {
  userId: string;
  limit: number;
  offset: number;
  filters: {
    search?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
    startDate?: string;
    endDate?: string;
    status?: string;
    paymentConfigId?: number;
  };
}
