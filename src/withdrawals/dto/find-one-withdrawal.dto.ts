// Enums
export enum WithdrawalStatus {
  PENDING_SIGNATURE = 'PENDING_SIGNATURE',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// DTOs base
export class PersonalInfoDto {
  firstName: string;
  lastName: string;
}

export class BankInfoDto {
  bankName: string;
  accountNumber: string;
  cci: string;
}

export class UserDto {
  id: string;
  email: string;
  personalInfo: PersonalInfoDto;
  bankInfo: BankInfoDto;
}

export class PointsDto {
  transactionId: string;
  amount?: number;
}

export class WithdrawalPointDto {
  id: number;
  amountUsed: number;
  pointsTransactionId: string;
  pointsAmount?: number;
  metadata: Record<string, any>; // Guardamos como genérico según tu indicación
  createdAt: Date;
  points: PointsDto;
}

export class WithdrawalReviewDto {
  id: string;
  email: string;
}

export class FindOneWithdrawalResponseDto {
  id: number;
  amount: number;
  status: WithdrawalStatus;
  createdAt: Date;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  isArchived: boolean;
  metadata: Record<string, any>; // Guardamos como genérico según tu indicación
  bankName: string;
  accountNumber: string;
  cci: string;
  pdfUrl: string | null;
  user: UserDto;
  reviewedBy: WithdrawalReviewDto | null; // Podría ser un objeto más complejo según tu implementación
  withdrawalPoints: WithdrawalPointDto[];
}
