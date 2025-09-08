import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Withdrawal } from './withdrawal.entity';

@Entity('withdrawal_points')
export class WithdrawalPoints {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Withdrawal, (withdrawal) => withdrawal.withdrawalPoints)
  @JoinColumn({ name: 'withdrawal_id' })
  withdrawal: Withdrawal;

  @Column({ name: 'points_transaction_id' })
  pointsTransaction: string;

  @Column({
    name: 'points_amount',
    type: 'decimal',
    nullable: true,
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  pointsAmount?: number;

  @Column({
    type: 'decimal',
    name: 'amount_used',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  amountUsed: number;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
