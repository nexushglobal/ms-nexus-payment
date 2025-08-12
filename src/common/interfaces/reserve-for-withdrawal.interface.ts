import { ReservedPointsTransaction } from './reserved-points-transaction.interface';

export interface ReserveForWithdrawal {
  success: boolean;
  pointsTransaction: ReservedPointsTransaction[];
}
