export interface CulqiCustomer {
  object: string;
  id: string;
  creation_date: number;
  email: string;
  antifraud_details: {
    country_code: string;
    first_name: string;
    last_name: string;
    address_city: string;
    address: string;
    phone: string;
    object: string;
  };
  cards?: any[]; // Se incluye cuando se consulta un customer específico
  metadata: Record<string, any>;
}

export interface CreateCulqiCustomerRequest {
  first_name: string;
  last_name: string;
  email: string;
  address: string;
  address_city: string;
  country_code: string;
  phone_number: string;
  metadata?: Record<string, any>;
}

export interface UpdateCulqiCustomerRequest {
  first_name?: string;
  last_name?: string;
  address?: string;
  address_city?: string;
  country_code?: string;
  phone_number?: string;
  metadata?: Record<string, any>;
}

export interface CulqiCustomerDeleteResponse {
  id: string;
  deleted: boolean;
  merchant_message: string;
}

// DTOs para nuestro microservicio
export interface CreateCustomerDto {
  userId: string;
  userEmail: string;
  first_name: string;
  last_name: string;
  address: string;
  address_city: string;
  country_code: string;
  phone_number: string;
  metadata?: Record<string, any>;
}

export interface UpdateCustomerDto {
  first_name?: string;
  last_name?: string;
  address?: string;
  address_city?: string;
  country_code?: string;
  phone_number?: string;
  metadata?: Record<string, any>;
}

export interface CustomerResponse {
  id: number;
  userId: string;
  userEmail: string;
  culqiCustomerId: string;
  isActive: boolean;
  metadata?: Record<string, any>;
  culqiData?: CulqiCustomer;
  createdAt: Date;
  updatedAt: Date;
}
