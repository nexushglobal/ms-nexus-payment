export interface AdminPaymentResponse {
  id: number;
  amount: number;
  status: string;
  paymentMethod: string;
  operationCode?: string;
  ticketNumber?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  paymentConfig: {
    name: string;
  };
  user: {
    id: string;
    email: string;
    fullName: string;
    documentNumber?: string;
  };
}
