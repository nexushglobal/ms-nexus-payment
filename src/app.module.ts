import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './config/database.config';
import { PaymentModule } from './payment/payment.module';
import { MigrationModule } from './migration/migration.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => databaseConfig,
    }),
    PaymentModule,
    MigrationModule,
  ],

  controllers: [],
  providers: [],
})
export class AppModule {}
