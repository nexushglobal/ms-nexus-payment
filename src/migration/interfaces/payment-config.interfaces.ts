export interface PaymentConfigMigrationData {
  id: number;
  code: string;
  name?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentConfigMigrationResult {
  success: boolean;
  message: string;
  details: {
    paymentConfigs: {
      total: number;
      created: number;
      skipped: number;
      errors: string[];
    };
  };
}
