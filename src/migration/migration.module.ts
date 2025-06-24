import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentConfig } from '../payment/entities/payment-config.entity';
import { PaymentConfigMigrationController } from './controllers/payment-config-migration.controller';
import { PaymentConfigMigrationService } from './services/payment-config-migration.service';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentConfig])],
  controllers: [PaymentConfigMigrationController],
  providers: [PaymentConfigMigrationService],
  exports: [PaymentConfigMigrationService],
})
export class MigrationModule {}
