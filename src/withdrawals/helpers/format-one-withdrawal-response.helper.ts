import { Withdrawal } from '../entities/withdrawal.entity';

export const formatOneWithdrawalResponse = (withdrawal: Withdrawal) => {
  return {
    id: withdrawal.id,
    amount: withdrawal.amount,
    status: withdrawal.status,
    createdAt: withdrawal.createdAt,
    reviewedAt: withdrawal.reviewedAt,
    rejectionReason: withdrawal.rejectionReason,
    isArchived: withdrawal.isArchived,
    metadata: withdrawal.metadata,

    // Información bancaria
    bankName: withdrawal.bankName,
    accountNumber: withdrawal.accountNumber,
    cci: withdrawal.cci,

    // Información del usuario (usando datos desnormalizados)
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

    // Información del revisor (usando datos desnormalizados)
    reviewedBy: withdrawal.reviewedById
      ? {
          id: withdrawal.reviewedById,
          email: withdrawal.reviewedByEmail,
        }
      : null,

    // Puntos de retiro (adaptado para nueva estructura)
    withdrawalPoints:
      withdrawal.withdrawalPoints?.map((wp) => {
        return {
          id: wp.id,
          amountUsed: wp.amountUsed,
          pointsTransactionId: wp.pointsTransaction,
          pointsAmount: wp.pointsAmount,
          metadata: wp.metadata,
          createdAt: wp.createdAt,

          // Nota: En microservicios, la información detallada de puntos
          // se obtendría del microservicio de puntos usando pointsTransactionId
          points: {
            transactionId: wp.pointsTransaction,
            amount: wp.pointsAmount,
            // Los demás campos requerirían consulta al microservicio de puntos
            // id, type, withdrawnAmount, pendingAmount, status, etc.
          },
        };
      }) || [],
  };
};
