import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('culqi_customers')
export class CulqiCustomer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @Column({ name: 'user_email' })
  userEmail: string;

  @Column({ name: 'culqi_customer_id', length: 25, unique: true })
  culqiCustomerId: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  validate() {
    if (this.userEmail) {
      this.userEmail = this.userEmail.toLowerCase().trim();
    }

    if (this.culqiCustomerId && !this.culqiCustomerId.startsWith('cus_')) {
      throw new Error('ID de customer de Culqi debe comenzar con "cus_"');
    }
  }
}
