import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PaymentItemType } from '../enum/payment-item.enum';
import { Payment } from './payment.entity';

@Entity('payment_items')
@Index(['payment'])
@Index(['itemType'])
export class PaymentItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Payment, (payment) => payment.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'payment_id' })
  payment: Payment;

  @Column({
    type: 'enum',
    enum: PaymentItemType,
    default: PaymentItemType.VOUCHER_IMAGE,
    name: 'item_type',
  })
  itemType: PaymentItemType;

  @Column({ nullable: true, length: 500 })
  url: string;

  @Column({ name: 'url_key', nullable: true, length: 200 })
  urlKey: string;

  @Column({ name: 'points_transaction_id', nullable: true, length: 100 })
  pointsTransactionId: string;

  @Column({
    name: 'payment_gateway_transaction_id',
    nullable: true,
    length: 100,
  })
  paymentGatewayTransactionId: string;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => (value ? parseFloat(value) : null),
    },
  })
  amount: number;

  @Column({ name: 'bank_name', nullable: true, length: 100 })
  bankName: string;

  @Column({ name: 'transaction_date', type: 'timestamp', nullable: true })
  transactionDate: Date;

  @BeforeInsert()
  @BeforeUpdate()
  validate() {
    if (this.transactionDate) {
      const now = new Date();
      if (this.transactionDate > now) {
        throw new Error('La fecha de transacción no puede ser futura');
      }
    }

    if (this.pointsTransactionId) {
      this.pointsTransactionId = this.pointsTransactionId.trim().toUpperCase();
    }

    if (this.bankName) {
      this.bankName = this.bankName.trim();
    }

    const hasImageData = this.url || this.urlKey;
    const hasTransactionData = this.pointsTransactionId;
    const hasPaymentGatewayTransactionId = this.paymentGatewayTransactionId;

    if (
      !hasImageData &&
      !hasTransactionData &&
      !hasPaymentGatewayTransactionId
    ) {
      throw new Error(
        'El item debe tener al menos una imagen o referencia de transacción',
      );
    }
  }
}
