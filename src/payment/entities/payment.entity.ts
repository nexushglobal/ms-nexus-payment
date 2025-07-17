import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentMethod } from '../enum/patment-method';
import { PaymentStatus } from '../enum/payment-status.enum';
import { PaymentConfig } from './payment-config.entity';
import { PaymentItem } from './payment-item.entity';

@Entity('payments')
@Index(['userId', 'paymentConfig'])
@Index(['status', 'createdAt'])
@Index(['userId', 'status'])
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @Column({ name: 'user_email' })
  userEmail: string;

  @Column({ name: 'user_name', nullable: true })
  userName: string;

  @ManyToOne(() => PaymentConfig, { nullable: false, eager: true })
  @JoinColumn({ name: 'payment_config_id' })
  paymentConfig: PaymentConfig;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  amount: number;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.VOUCHER,
    name: 'payment_method',
  })
  paymentMethod: PaymentMethod;

  @Column({ name: 'operation_code', nullable: true })
  operationCode: string;

  @Column({ name: 'bank_name', nullable: true })
  bankName: string;

  @Column({ name: 'operation_date', type: 'timestamp', nullable: true })
  operationDate: Date;

  @Column({ name: 'ticket_number', nullable: true })
  ticketNumber: string;

  @Column({ name: 'rejection_reason', nullable: true, length: 500 })
  rejectionReason: string;

  @OneToMany(() => PaymentItem, (item) => item.payment, {
    cascade: true,
    eager: false,
  })
  items: PaymentItem[];

  @Column({ name: 'reviewed_by_id', nullable: true })
  reviewedById: string;

  @Column({ name: 'reviewed_by_email', nullable: true })
  reviewedByEmail: string;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @Column({ name: 'is_archived', default: false })
  isArchived: boolean;

  @Column({ name: 'related_entity_type', nullable: true })
  relatedEntityType: string;

  @Column({ name: 'related_entity_id', nullable: true })
  relatedEntityId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ name: 'external_reference', nullable: true })
  externalReference: string;

  @Column({ name: 'gateway_transaction_id', nullable: true })
  gatewayTransactionId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  validate() {
    if (this.status === PaymentStatus.REJECTED && !this.rejectionReason) {
      throw new Error('Se requiere una razón para rechazar el pago');
    }

    if (this.amount <= 0) {
      throw new Error('El monto debe ser mayor a 0');
    }

    // Limpiar campos de texto
    if (this.operationCode) {
      this.operationCode = this.operationCode.trim().toUpperCase();
    }

    if (this.bankName) {
      this.bankName = this.bankName.trim();
    }

    if (this.ticketNumber) {
      this.ticketNumber = this.ticketNumber.trim();
    }
  }
}
