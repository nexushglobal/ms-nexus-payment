import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('culqi_charges')
export class CulqiCharge {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'culqi_charge_id', length: 25, unique: true })
  culqiChargeId: string; // ID del charge en Culqi (ej: chr_test_kEazTaQBDtzNdwFr)

  @Column({ name: 'user_id' })
  userId: string; // UUID del usuario que realizó el pago

  @Column({ name: 'user_email' })
  userEmail: string; // Email del usuario para referencia

  @Column({ name: 'source_id', length: 25 })
  sourceId: string; // Token o Card ID usado para el cargo

  @Column({ name: 'source_type', length: 10 })
  sourceType: string; // 'token' o 'card'

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  amount: number; // Monto en céntimos convertido a decimal

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    name: 'amount_refunded',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  amountRefunded: number; // Monto devuelto

  @Column({ name: 'currency_code', length: 3, default: 'PEN' })
  currencyCode: string; // PEN, USD

  @Column({ nullable: true, length: 80 })
  description: string; // Descripción del cargo

  @Column({ default: 0 })
  installments: number; // Número de cuotas

  @Column({ name: 'is_captured', default: true })
  isCaptured: boolean; // Si el cargo está capturado

  @Column({ name: 'is_paid', default: false })
  isPaid: boolean; // Si el cargo está pagado

  @Column({ name: 'is_disputed', default: false })
  isDisputed: boolean; // Si el cargo está en disputa

  @Column({
    name: 'fraud_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  fraudScore: number; // Score de fraude

  @Column({ name: 'outcome_type', length: 50, nullable: true })
  outcomeType: string; // Tipo de resultado

  @Column({ name: 'outcome_code', length: 20, nullable: true })
  outcomeCode: string; // Código de resultado

  @Column({ name: 'decline_code', length: 50, nullable: true })
  declineCode: string; // Código de denegación si falló

  @Column({ name: 'reference_code', length: 50, nullable: true })
  referenceCode: string; // Código de referencia del banco

  @Column({ name: 'authorization_code', length: 20, nullable: true })
  authorizationCode: string; // Código de autorización

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>; // Metadata adicional

  @Column({ name: 'culqi_creation_date', type: 'bigint', nullable: true })
  culqiCreationDate: number; // Fecha de creación en Culqi (timestamp)

  @Column({ name: 'capture_date', type: 'timestamp', nullable: true })
  captureDate: Date; // Fecha de captura

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  validate() {
    if (this.culqiChargeId && !this.culqiChargeId.startsWith('chr_')) {
      throw new Error('ID de charge de Culqi debe comenzar con "chr_"');
    }

    if (this.userEmail) {
      this.userEmail = this.userEmail.toLowerCase().trim();
    }

    if (this.amount < 0) {
      throw new Error('El monto no puede ser negativo');
    }

    if (this.amountRefunded < 0) {
      throw new Error('El monto devuelto no puede ser negativo');
    }

    if (this.amountRefunded > this.amount) {
      throw new Error('El monto devuelto no puede ser mayor al monto original');
    }
  }
}
