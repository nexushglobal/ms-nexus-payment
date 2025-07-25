import { PaymentMethod } from '../enum/patment-method';

export interface CreatePaymentData {
  userId: string;
  userEmail: string;
  username: string;
  paymentConfig: string;
  amount: number;
  status: string;
  paymentMethod: PaymentMethod;
  relatedEntityType: string;
  relatedEntityId: number;
  metadata: any;
  payments?: any[];
  files?: Array<{
    originalname: string;
    buffer: Buffer;
    mimetype: string;
    size: number;
  }>;
  source_ip: string;
}
