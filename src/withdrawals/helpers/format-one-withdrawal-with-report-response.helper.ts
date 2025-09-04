import {
  FindOneWithdrawalWithReportResponseDto,
  PaymentInfoDto,
  WithdrawalPointWithReportDto,
} from '../dto/find-one-withdrawal-with-report.dto';
import { WithdrawalPoints } from '../entities/wirhdrawal-points.entity';
import { Withdrawal } from '../entities/withdrawal.entity';

export function formatOneWithdrawalWithReportResponse(
  withdrawal: Withdrawal,
  paymentsInfoMap: Map<string, PaymentInfoDto[]>,
): FindOneWithdrawalWithReportResponseDto {
  return {
    id: withdrawal.id,
    amount: withdrawal.amount,
    status: withdrawal.status,
    createdAt: withdrawal.createdAt,
    reviewedAt: withdrawal.reviewedAt,
    rejectionReason: withdrawal.rejectionReason,
    isArchived: withdrawal.isArchived,
    metadata: withdrawal.metadata,
    bankName: withdrawal.bankName,
    accountNumber: withdrawal.accountNumber,
    cci: withdrawal.cci,
    pdfUrl: withdrawal.pdfUrl,
    user: {
      id: withdrawal.userId,
      email: withdrawal.userEmail,
      personalInfo: {
        firstName: withdrawal.userName?.split(' ')[0] || '', // Extraer primer nombre
        lastName: withdrawal.userName?.split(' ').slice(1).join(' ') || '', // Resto como apellido
        // documentNumber: null, // No disponible en entidad desnormalizada
      },
      bankInfo: {
        bankName: withdrawal.bankName,
        accountNumber: withdrawal.accountNumber,
        cci: withdrawal.cci,
      },
    },
    reviewedBy: withdrawal.reviewedById
      ? {
          id: withdrawal.reviewedById,
          email: withdrawal.reviewedByEmail,
        }
      : null,
    withdrawalPoints: withdrawal.withdrawalPoints.map(
      (point: WithdrawalPoints): WithdrawalPointWithReportDto => ({
        id: point.id,
        amountUsed: point.amountUsed,
        pointsTransactionId: point.id.toString(),
        pointsAmount: point.pointsAmount ?? 0,
        metadata: point.metadata,
        createdAt: point.createdAt,
        points: {
          transactionId: point.pointsTransaction,
          amount: point.amountUsed,
        },
        // AQUÍ está la diferencia: incluye información de pagos
        paymentsInfo: paymentsInfoMap.get(point.pointsTransaction) || [],
      }),
    ),
  };
}
