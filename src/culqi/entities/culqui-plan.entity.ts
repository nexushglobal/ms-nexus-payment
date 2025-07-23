import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('culqi_plans')
export class CulqiPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'culqi_plan_id', length: 25, unique: true, nullable: true })
  culqiPlanId: string; // ID del plan en Culqi (ej: pln_test_XXXXXXXXXXXXXXXX)

  @Column({ length: 50, unique: true })
  code: string; // Código único para identificar el plan (ej: RECONSUMO-100, RECONSUMO-300)

  @Column({ length: 50 })
  name: string; // Nombre del plan

  @Column({ name: 'short_name', length: 50 })
  shortName: string; // Nombre corto del plan

  @Column({ length: 200 })
  description: string; // Descripción del plan

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  amount: number; // Monto del plan (convertido de céntimos)

  @Column({ name: 'currency_code', length: 3, default: 'PEN' })
  currencyCode: string; // PEN, USD

  @Column({ name: 'interval_unit_time' })
  intervalUnitTime: number; // 1=Diario, 2=Semanal, 3=Mensual, 4=Anual, 5=Trimestral, 6=Semestral

  @Column({ name: 'interval_count' })
  intervalCount: number; // Cantidad de intervalos entre cada cargo

  @Column({ name: 'initial_cycles_count', default: 0 })
  initialCyclesCount: number; // Número de ciclos iniciales

  @Column({ name: 'has_initial_charge', default: false })
  hasInitialCharge: boolean; // Si tiene cargo inicial

  @Column({
    name: 'initial_cycles_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  initialCyclesAmount: number; // Monto del cargo inicial

  @Column({ name: 'initial_cycles_interval_unit_time', default: 1 })
  initialCyclesIntervalUnitTime: number; // Unidad de tiempo para ciclos iniciales

  @Column({ name: 'image_url', nullable: true })
  imageUrl: string; // URL de la imagen del plan

  @Column({ name: 'total_subscriptions', default: 0 })
  totalSubscriptions: number; // Total de suscripciones activas

  @Column({ default: 1 }) // 1=Activo, 2=Inactivo
  status: number; // Estado del plan

  @Column({ name: 'culqi_creation_date', type: 'bigint', nullable: true })
  culqiCreationDate: number; // Fecha de creación en Culqi (UNIX timestamp)

  @Column({ name: 'culqi_slug', nullable: true })
  culqiSlug: string; // UUID v4 que identifica al plan en Culqi

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
  normalizeFields() {
    if (this.code) {
      this.code = this.code.toUpperCase().trim();
    }
    if (this.shortName) {
      this.shortName = this.shortName.toLowerCase().replace(/\s+/g, '-');
    }
    if (this.name) {
      this.name = this.name.trim();
    }
    if (this.description) {
      this.description = this.description.trim();
    }
  }

  // Método helper para obtener el texto del intervalo
  getIntervalText(): string {
    const intervals = {
      1: 'Diario',
      2: 'Semanal',
      3: 'Mensual',
      4: 'Anual',
      5: 'Trimestral',
      6: 'Semestral',
    };
    return intervals[this.intervalUnitTime] || 'Desconocido';
  }

  // Método helper para obtener el estado del plan
  getStatusText(): string {
    return this.status === 1 ? 'Activo' : 'Inactivo';
  }
}
