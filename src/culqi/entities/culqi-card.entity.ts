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
import { CulqiCustomer } from './culqi-customer.entity';

@Entity('culqi_cards')
export class CulqiCard {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'culqi_card_id', length: 25, unique: true })
  culqiCardId: string; // ID de la card en Culqi (ej: crd_test_TWsfemI22ypplGK6)

  @ManyToOne(() => CulqiCustomer, { nullable: false, eager: true })
  @JoinColumn({ name: 'culqi_customer_id', referencedColumnName: 'id' })
  culqiCustomer: CulqiCustomer;

  @Column({ name: 'culqi_customer_culqi_id', length: 25 })
  culqiCustomerCulqiId: string; // ID del customer en Culqi para referencia rápida

  @Column({ name: 'token_id', length: 25 })
  tokenId: string; // Token usado para crear la card

  @Column({ name: 'last_four', length: 4 })
  lastFour: string; // Últimos 4 dígitos de la tarjeta

  @Column({ name: 'card_brand', length: 20 })
  cardBrand: string; // Visa, Mastercard, etc.

  @Column({ name: 'card_type', length: 20 })
  cardType: string; // credito, debito, etc.

  @Column({ name: 'is_active', default: true })
  isActive: boolean; // Para soft delete y control de estado

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>; // Metadata adicional

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  validate() {
    if (this.culqiCardId && !this.culqiCardId.startsWith('crd_')) {
      throw new Error('ID de card de Culqi debe comenzar con "crd_"');
    }

    if (
      this.culqiCustomerCulqiId &&
      !this.culqiCustomerCulqiId.startsWith('cus_')
    ) {
      throw new Error('ID de customer de Culqi debe comenzar con "cus_"');
    }

    if (this.tokenId && !this.tokenId.startsWith('tkn_')) {
      throw new Error('ID de token de Culqi debe comenzar con "tkn_"');
    }
  }
}
