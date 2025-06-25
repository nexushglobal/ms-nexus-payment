import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentConfig } from '../payment/entities/payment-config.entity';
import { Payment } from '../payment/entities/payment.entity';
import { PaymentItem } from '../payment/entities/payment-item.entity';
import { PaymentConfigMigrationController } from './controllers/payment-config-migration.controller';
import { PaymentMigrationController } from './controllers/payment-migration.controller';
import { PaymentConfigMigrationService } from './services/payment-config-migration.service';
import { PaymentMigrationService } from './services/payment-migration.service';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentConfig, Payment, PaymentItem])],
  controllers: [PaymentConfigMigrationController, PaymentMigrationController],
  providers: [PaymentConfigMigrationService, PaymentMigrationService],
  exports: [PaymentConfigMigrationService, PaymentMigrationService],
})
export class MigrationModule {}
