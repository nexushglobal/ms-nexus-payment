import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WithdrawalPoints } from './wirhdrawal-points.entity';

export enum WithdrawalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('withdrawals')
@Index(['userId', 'status'])
@Index(['createdAt'])
export class Withdrawal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @Column({ name: 'user_email' })
  userEmail: string;

  @Column({ name: 'user_name', nullable: true })
  userName: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  amount: number;

  @Column()
  status: WithdrawalStatus;

  @Column({ nullable: true, name: 'rejection_reason' })
  rejectionReason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(
    () => WithdrawalPoints,
    (withdrawalPoints) => withdrawalPoints.withdrawal,
  )
  @JoinColumn({ name: 'withdrawal_id' })
  withdrawalPoints: WithdrawalPoints[];

  @Column({ name: 'reviewed_by_id', nullable: true })
  reviewedById: string;

  @Column({ name: 'reviewed_by_email', nullable: true })
  reviewedByEmail: string;

  @Column({ nullable: true, type: 'timestamp', name: 'reviewed_at' })
  reviewedAt: Date;

  @Column({ default: false, name: 'is_archived' })
  isArchived: boolean;

  // Detalles bancarios para el retiro
  @Column({ name: 'bank_name' })
  bankName: string;

  @Column({ name: 'account_number' })
  accountNumber: string;

  @Column({ nullable: true })
  cci: string;

  // Metadatos adicionales
  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @BeforeInsert()
  @BeforeUpdate()
  validateWithdrawal() {
    // Si el retiro está rechazado, debe haber una razón
    if (this.status === WithdrawalStatus.REJECTED && !this.rejectionReason) {
      throw new Error('Se requiere una razón para rechazar el retiro');
    }
  }
}
