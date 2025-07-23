export interface CulqiErrorResponse {
  object: string;
  type: string;
  code?: string;
  decline_code?: string;
  merchant_message: string;
  user_message?: string;
  param?: string;
  charge_id?: string;
}

export interface TokenFilters {
  creation_date?: string;
  creation_date_from?: string;
  creation_date_to?: string;
  card_brand?: 'Visa' | 'Mastercard' | 'Amex' | 'Diner';
  card_type?: 'credito' | 'debito' | 'internacional';
  device_type?: 'escritorio' | 'movil' | 'tablet';
  bin?: string;
  country_code?: string;
  limit?: string;
  before?: string;
  after?: string;
}

export interface CulqiPaginatedResponse<T> {
  data: T[];
  paging: {
    previous?: string;
    next?: string;
    cursors: {
      before?: string;
      after?: string;
    };
  };
}

export interface CulqiToken {
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
}

export interface ValidateTokenResponse {
  isValid: boolean;
  token?: CulqiToken;
  error?: string;
  trackingId?: string | null;
}

export interface CulqiHttpOptions {
  endpoint: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: any;
  usePublicKey?: boolean;
}

export interface CulqiHttpResponse<T = any> {
  data: T;
  trackingId?: string | null;
  status: number;
}
