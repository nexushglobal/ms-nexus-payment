import { Withdrawal } from '../entities/withdrawal.entity';

export const formatListWithdrawalsResponse = (withdrawals: Withdrawal[]) => {
  return withdrawals.map((withdrawal) => ({
    id: withdrawal.id,
    amount: withdrawal.amount,
    status: withdrawal.status,
    createdAt: withdrawal.createdAt,
    reviewedAt: withdrawal.reviewedAt,

    // Información bancaria básica
    bankName: withdrawal.bankName,
    accountNumber: withdrawal.accountNumber,
    pdfUrl: withdrawal.pdfUrl,

    // Información del usuario (desnormalizada)
    user: {
      id: withdrawal.userId,
      email: withdrawal.userEmail,
      name: withdrawal.userName,
    },

    // Información del revisor (desnormalizada)
    reviewedBy: withdrawal.reviewedById
      ? {
          id: withdrawal.reviewedById,
          email: withdrawal.reviewedByEmail,
        }
      : null,

    // Metadatos básicos
    metadata: withdrawal.metadata,
  }));
};
