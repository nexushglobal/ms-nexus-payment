import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './config/database.config';
import { PaymentModule } from './payment/payment.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => databaseConfig,
    }),
    PaymentModule,
  ],

  controllers: [],
  providers: [],
})
export class AppModule {}
