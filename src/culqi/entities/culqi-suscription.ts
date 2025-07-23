import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CulqiCard } from './culqi-card.entity';
import { CulqiCustomer } from './culqi-customer.entity';
import { CulqiPlan } from './culqui-plan.entity';

@Entity('culqi_subscriptions')
export class CulqiSubscription {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: 'culqi_subscription_id',
    length: 25,
    unique: true,
    nullable: true,
  })
  culqiSubscriptionId: string; // ID de la suscripción en Culqi (ej: sxn_test_XXXXXXXXXXXXXXXX)

  @Column({ name: 'user_id' })
  userId: string; // UUID del usuario suscrito

  @Column({ name: 'user_email' })
  userEmail: string; // Email del usuario para referencia

  @ManyToOne(() => CulqiCustomer, { nullable: false, eager: true })
  @JoinColumn({ name: 'culqi_customer_id', referencedColumnName: 'id' })
  culqiCustomer: CulqiCustomer;

  @ManyToOne(() => CulqiCard, { nullable: false, eager: true })
  @JoinColumn({ name: 'culqi_card_id', referencedColumnName: 'id' })
  culqiCard: CulqiCard;

  @ManyToOne(() => CulqiPlan, { nullable: false, eager: true })
  @JoinColumn({ name: 'culqi_plan_id', referencedColumnName: 'id' })
  culqiPlan: CulqiPlan;

  @Column({
    default: 1,
    comment:
      '1=Creada, 2=Días de prueba, 3=Activa, 4=Cancelada, 5=En cola, 6=Finalizada',
  })
  status: number; // Estado de la suscripción

  @Column({ name: 'current_period', default: 1 })
  currentPeriod: number; // Número del periodo de facturación actual

  @Column({ name: 'total_periods', nullable: true })
  totalPeriods: number; // Total de períodos (si hay límite)

  @Column({ name: 'next_billing_date', type: 'bigint', nullable: true })
  nextBillingDate: number; // Próxima fecha de facturación (UNIX timestamp)

  @Column({ name: 'trial_start', type: 'bigint', nullable: true })
  trialStart: number; // Fecha de inicio del período de prueba (UNIX timestamp)

  @Column({ name: 'trial_end', type: 'bigint', nullable: true })
  trialEnd: number; // Fecha de finalización del período de prueba (UNIX timestamp)

  @Column({ name: 'culqi_creation_date', type: 'bigint', nullable: true })
  culqiCreationDate: number; // Fecha de creación en Culqi (UNIX timestamp)

  @Column({ name: 'cancellation_date', type: 'bigint', nullable: true })
  cancellationDate: number; // Fecha de cancelación (UNIX timestamp)

  @Column({ name: 'terms_and_conditions', default: false })
  termsAndConditions: boolean; // Aceptación de términos y condiciones

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>; // Metadatos adicionales

  @Column({ name: 'is_active', default: true })
  isActive: boolean; // Control local de estado

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  validate() {
    if (
      this.culqiSubscriptionId &&
      !this.culqiSubscriptionId.startsWith('sxn_')
    ) {
      throw new Error('ID de suscripción de Culqi debe comenzar con "sxn_"');
    }

    if (this.status < 1 || this.status > 6) {
      throw new Error('Estado de suscripción debe estar entre 1 y 6');
    }

    if (this.currentPeriod < 1) {
      throw new Error('El período actual debe ser mayor a 0');
    }
  }

  // Método helper para obtener el texto del estado
  getStatusText(): string {
    const statuses = {
      1: 'Creada',
      2: 'Días de prueba',
      3: 'Activa',
      4: 'Cancelada',
      5: 'En cola',
      6: 'Finalizada',
    };
    return statuses[this.status] || 'Desconocido';
  }

  // Método helper para verificar si está activa
  isActiveSubscription(): boolean {
    return this.isActive && [1, 2, 3, 5].includes(this.status);
  }

  // Método helper para verificar si puede ser cancelada
  canBeCancelled(): boolean {
    return this.isActive && [1, 2, 3, 5].includes(this.status);
  }

  // Método helper para verificar si está en período de prueba
  isInTrialPeriod(): boolean {
    if (!this.trialStart || !this.trialEnd) return false;
    const now = Math.floor(Date.now() / 1000);
    return now >= this.trialStart && now <= this.trialEnd;
  }
}
