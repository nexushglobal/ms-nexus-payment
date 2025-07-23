export interface CulqiCard {
  object: string;
  id: string;
  active: boolean;
  creation_date: number;
  customer_id: string;
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
  metadata: Record<string, any>;
}

export interface CreateCulqiCardRequest {
  customer_id: string;
  token_id: string;
  validate?: boolean;
  authentication_3DS?: any;
  metadata?: Record<string, any>;
}

export interface UpdateCulqiCardRequest {
  token_id?: string;
  metadata?: Record<string, any>;
}

export interface CulqiCardDeleteResponse {
  id: string;
  deleted: boolean;
  merchant_message: string;
}

export interface CulqiCard3DSResponse {
  user_message: string;
  action_code: string;
}

// DTOs para nuestro microservicio
export interface CreateCardDto {
  userId: string; // Para identificar al customer
  tokenId: string;
  validate?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdateCardDto {
  tokenId?: string;
  metadata?: Record<string, any>;
}

export interface CardResponse {
  id: number;
  culqiCardId: string;
  culqiCustomerId: number;
  culqiCustomerCulqiId: string;
  tokenId: string;
  lastFour: string;
  cardBrand: string;
  cardType: string;
  isActive: boolean;
  metadata?: Record<string, any>;
  culqiData?: CulqiCard;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetCardDto {
  userId: string;
  cardId?: string; // Opcional: si se especifica, busca una card específica
}

export interface UpdateCardRequestDto {
  userId: string;
  cardId: string;
  data: UpdateCardDto;
}

export interface DeleteCardDto {
  userId: string;
  cardId: string;
}
