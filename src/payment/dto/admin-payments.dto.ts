export interface GetAdminPaymentsDto {
  limit: number;
  offset: number;
  filters?: {
    search?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
    startDate?: string;
    endDate?: string;
    status?: string;
    paymentConfigId?: number;
  };
}
