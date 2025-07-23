export interface CulqiCharge {
  object: string;
  id: string;
  creation_date: number;
  amount: number;
  amount_refunded: number;
  current_amount: number;
  installments: number;
  installments_amount: number | null;
  currency_code: string;
  email: string;
  description: string | null;
  source: {
    object: string;
    id: string;
    type: string;
    creation_date: number;
    email: string;
    card_number: string;
    last_four: string;
    active: boolean;
    iin: {
      object: string;
      bin: string;
      card_brand: string;
      card_type: string;
      card_category: string;
      issuer: any;
      installments_allowed: any[];
    };
    client: {
      ip: string;
      ip_country: string;
      ip_country_code: string;
      browser: string;
      device_fingerprint: string;
      device_type: string;
    };
    metadata?: any;
  };
  outcome: {
    type: string;
    code: string;
    decline_code?: string;
    merchant_message: string;
    user_message: string;
  };
  fraud_score: number;
  antifraud_details: {
    first_name: string;
    last_name: string;
    address: string | null;
    address_city: string;
    country_code: string;
    phone: string;
    object: string;
  };
  dispute: boolean;
  capture: boolean;
  reference_code: string;
  authorization_code?: string;
  duplicated: boolean;
  metadata: Record<string, any>;
  fee_details: {
    fixed_fee: any;
    variable_fee: any;
  };
  total_fee: number;
  total_fee_taxes: number;
  transfer_amount: number;
  paid: boolean;
  statement_descriptor: string;
  transfer_id: string | null;
  operations: any[];
  capture_date?: number;
}

export interface CreateCulqiChargeRequest {
  amount: number;
  currency_code: string;
  email: string;
  source_id: string;
  capture?: boolean;
  description?: string;
  installments?: number;
  metadata?: Record<string, any>;
  antifraud_details?: {
    address: string;
    address_city: string;
    country_code: string;
    first_name: string;
    last_name: string;
    phone_number: string;
  };
  authentication_3DS?: any;
}

export interface UpdateCulqiChargeRequest {
  metadata?: Record<string, any>;
}

export interface CulqiCharge3DSResponse {
  user_message: string;
  action_code: string;
}

// DTOs para nuestro microservicio
export interface CreateChargeDto {
  userId: string;
  userEmail: string;
  amount: number; // En céntimos (ej: 10000 = 100.00)
  currencyCode: 'PEN' | 'USD';
  sourceId: string; // Token ID o Card ID
  sourceType: 'token' | 'card';
  capture?: boolean;
  description?: string;
  installments?: number;
  metadata?: Record<string, any>;
  antifraudDetails?: {
    address: string;
    address_city: string;
    country_code: string;
    first_name: string;
    last_name: string;
    phone_number: string;
  };
}

export interface UpdateChargeDto {
  metadata?: Record<string, any>;
}

export interface ChargeResponse {
  id: number;
  culqiChargeId: string;
  userId: string;
  userEmail: string;
  sourceId: string;
  sourceType: string;
  amount: number;
  amountRefunded: number;
  currencyCode: string;
  description: string;
  installments: number;
  isCaptured: boolean;
  isPaid: boolean;
  isDisputed: boolean;
  fraudScore: number;
  outcomeType: string;
  outcomeCode: string;
  declineCode: string;
  referenceCode: string;
  authorizationCode: string;
  metadata?: Record<string, any>;
  culqiCreationDate: number;
  captureDate: Date;
  culqiData?: CulqiCharge;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetChargeDto {
  userId?: string; // Opcional: para filtrar por usuario
  chargeId: string; // ID del charge de Culqi
}

export interface UpdateChargeRequestDto {
  chargeId: string;
  data: UpdateChargeDto;
}

export interface CaptureChargeDto {
  chargeId: string; // ID del charge de Culqi
}

export interface GetUserChargesDto {
  userId: string;
  limit?: number;
  offset?: number;
}
