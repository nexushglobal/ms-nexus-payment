export interface PaymentItemMigrationData {
  id: number;
  url?: string | null;
  amount: number;
  bankName?: string | null;
  transactionReference?: string | null;
  transactionDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentMigrationData {
  id: number;
  userEmail: string;
  paymentConfigId: number;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  paymentMethod: 'VOUCHER' | 'POINTS' | 'PAYMENT_GATEWAY';
  operationCode?: string | null;
  ticketNumber?: string | null;
  rejectionReason?: string | null;
  items: PaymentItemMigrationData[];
  reviewedById?: string | null;
  reviewedByEmail?: string | null;
  reviewedAt?: string | null;
  isArchived: boolean;
  relatedEntityType?: string | null;
  relatedEntityId?: number | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentMigrationResult {
  success: boolean;
  message: string;
  details: {
    payments: {
      total: number;
      created: number;
      skipped: number;
      errors: string[];
    };
    paymentItems: {
      total: number;
      created: number;
      skipped: number;
      errors: string[];
    };
  };
}
