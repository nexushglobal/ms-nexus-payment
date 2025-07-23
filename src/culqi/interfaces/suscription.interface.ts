// DTOs para Suscripción
export interface CreateSubscriptionDto {
  userId: string; // Para identificar al customer
  userEmail: string; // Email del usuario
  cardId: string; // ID de la tarjeta en Culqi (crd_test_XXXXXXXX)
  planId: string; // ID del plan en Culqi (pln_test_XXXXXXXX) o código local
  termsAndConditions: boolean; // Aceptación de términos y condiciones
  metadata?: Record<string, any>;
}

export interface UpdateSubscriptionDto {
  cardId?: string; // Cambiar tarjeta activa
  metadata?: Record<string, any>;
}

export interface GetSubscriptionsDto {
  userId?: string; // Filtrar por usuario específico
  planId?: string; // Filtrar por plan específico
  status?: number; // Filtrar por estado
  creationDateFrom?: number; // Fecha inicio (UNIX timestamp)
  creationDateTo?: number; // Fecha fin (UNIX timestamp)
  limit?: number; // Límite de resultados (1-100)
  before?: string; // ID de suscripción para paginación anterior
  after?: string; // ID de suscripción para paginación siguiente
}

// Response interfaces
export interface SubscriptionResponse {
  id: string; // culqiSubscriptionId
  localId: number; // ID local
  userId: string;
  userEmail: string;
  customer: {
    id: string;
    // firstName: string;
    // lastName: string;
    email: string;
  };
  card: {
    id: string;
    lastFour: string;
    cardBrand: string;
    cardType: string;
  };
  plan: {
    id: string;
    code?: string; // Código local si existe
    name: string;
    amount: number;
    currencyCode: string;
    intervalUnitTime: number;
    intervalUnitText: string;
  };
  status: number;
  statusText: string;
  currentPeriod: number;
  totalPeriods?: number;
  nextBillingDate?: number;
  trialStart?: number;
  trialEnd?: number;
  isInTrialPeriod: boolean;
  creationDate: number;
  cancellationDate?: number;
  termsAndConditions: boolean;
  metadata?: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionsListResponse {
  data: SubscriptionResponse[];
  paging?: {
    previous?: string;
    next?: string;
  };
  cursors?: {
    before?: string;
    after?: string;
  };
  remainingItems?: number;
  total: number;
}

// Interfaces para Culqi API
export interface CulqiSubscriptionInterface {
  id: string;
  status: number;
  creation_date: number;
  next_billing_date: number;
  current_period: number;
  trial_start?: number;
  trial_end?: number;
  active_card: string;
  plan: {
    plan_id: string;
    name: string;
    amount: number;
    currency: string;
    interval_unit_time: number;
  };
  periods?: Array<{
    period: number;
    status: number;
    charges?: Record<string, any>;
  }>;
  customer: {
    first_name: string;
    last_name: string;
    email: string;
  };
  metadata?: Record<string, any>;
}

export interface CulqiCreateSubscriptionRequest {
  card_id: string;
  plan_id: string;
  tyc: boolean; // terms and conditions
  metadata?: Record<string, any>;
}

export interface CulqiUpdateSubscriptionRequest {
  card_id?: string;
  metadata?: Record<string, any>;
}

export interface CulqiSubscriptionResponse {
  id: string;
  customer_id: string;
  plan_id: string;
  status: number;
  created_at: number;
  metadata?: Record<string, any>;
}

export interface CulqiDeleteSubscriptionResponse {
  id: string;
  delete: boolean;
  merchant_message: string;
}

// Interfaces para listado con filtros
export interface CulqiSubscriptionsListResponse {
  data: {
    id: string;
    creation_date: number;
    status: number;
    current_period: number;
    total_period?: number;
    next_billing_date: number;
    trial_start?: number;
    trial_end?: number;
    plan_id: string;
    card_id: string;
    customer: {
      first_name?: string;
      last_name?: string;
      email?: string;
    };
    metadata?: Record<string, any>;
  };
  paging?: {
    previous?: string;
    next?: string;
  };
  cursors?: {
    before?: string;
    after?: string;
  };
  remaining_items?: number;
}

// Helper interfaces
export interface SubscriptionSummary {
  totalSubscriptions: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  cancelledSubscriptions: number;
  revenueThisMonth: number;
  nextBillings: Array<{
    subscriptionId: string;
    userId: string;
    planName: string;
    amount: number;
    nextBillingDate: number;
  }>;
}
