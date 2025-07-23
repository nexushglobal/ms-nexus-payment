// DTOs para Plan
export interface CreatePlanDto {
  code: string; // Código único (ej: RECONSUMO-100)
  name: string; // Nombre del plan
  shortName: string; // Nombre corto
  description: string; // Descripción
  amount: number; // Monto en soles/dólares (no céntimos)
  currencyCode?: string; // PEN o USD, default PEN
  intervalUnitTime: number; // 1=Diario, 2=Semanal, 3=Mensual, etc.
  intervalCount: number; // Cantidad de intervalos
  initialCycles?: {
    count?: number;
    hasInitialCharge?: boolean;
    amount?: number;
    intervalUnitTime?: number;
  };
  imageUrl?: string;
  metadata?: Record<string, any>;
}

export interface UpdatePlanDto {
  name?: string;
  shortName?: string;
  description?: string;
  status?: number; // 1=Activo, 2=Inactivo
  imageUrl?: string;
  metadata?: Record<string, any>;
}

export interface GetPlansDto {
  amount?: number; // Filtrar por monto específico
  status?: number; // Filtrar por estado
  minAmount?: number; // Monto mínimo
  maxAmount?: number; // Monto máximo
  creationDateFrom?: number; // Fecha inicio (UNIX timestamp)
  creationDateTo?: number; // Fecha fin (UNIX timestamp)
  limit?: number; // Límite de resultados (1-100)
  before?: string; // ID del plan para paginación anterior
  after?: string; // ID del plan para paginación siguiente
}

// Response interfaces
export interface PlanResponse {
  id: string; // culqiPlanId
  localId: number; // ID local
  code: string; // Código único local
  name: string;
  shortName: string;
  description: string;
  amount: number; // En formato decimal (no céntimos)
  currencyCode: string;
  intervalUnitTime: number;
  intervalUnitText: string; // Texto descriptivo del intervalo
  intervalCount: number;
  initialCycles: {
    count: number;
    hasInitialCharge: boolean;
    amount: number;
    intervalUnitTime: number;
  };
  imageUrl?: string;
  totalSubscriptions: number;
  status: number;
  statusText: string; // Texto descriptivo del estado
  creationDate: number; // UNIX timestamp
  slug?: string;
  metadata?: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlansListResponse {
  data: PlanResponse[];
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
export interface CulqiPlanInterface {
  id: string;
  interval_unit_time: number;
  interval_count: number;
  amount: number; // En céntimos
  currency: string;
  name: string;
  description: string;
  short_name: string;
  initial_cycles: {
    count: number;
    has_initial_charge: boolean;
    amount: number;
    interval_unit_time: number;
  };
  metadata?: Record<string, any>;
  image?: string;
  total_subscriptions: number;
  status: number;
  creation_date: number;
  slug: string;
}

export interface CulqiCreatePlanRequest {
  name: string;
  short_name: string;
  description: string;
  amount: number; // En céntimos
  currency: string;
  interval_unit_time: number;
  interval_count: number;
  initial_cycles: {
    count: number;
    has_initial_charge: boolean;
    amount: number;
    interval_unit_time: number;
  };
  image?: string;
  metadata?: Record<string, any>;
}

export interface CulqiUpdatePlanRequest {
  name?: string;
  short_name?: string;
  description?: string;
  status?: number;
  image?: string;
  metadata?: Record<string, any>;
}

export interface CulqiPlanResponse {
  id: string;
  slug: string;
}

export interface CulqiDeletePlanResponse {
  id: string;
  deleted: boolean;
  merchant_message: string;
}
