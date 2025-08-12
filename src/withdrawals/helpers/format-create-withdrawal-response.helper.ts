import { Withdrawal } from '../entities/withdrawal.entity';

export const formatCreateWithdrawalResponse = (withdrawal: Withdrawal) => {
  return {
    success: true,
    message: 'Solicitud de retiro creada exitosamente',
    withdrawal: {
      id: withdrawal.id,
      amount: withdrawal.amount,
      status: withdrawal.status,
      createdAt: withdrawal.createdAt,
      bankName: withdrawal.bankName,
      accountNumber: withdrawal.accountNumber,
      cci: withdrawal.cci,
    },
  };
};
