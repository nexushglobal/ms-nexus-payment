import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from './common/common.module';
import { databaseConfig } from './config/database.config';
import { CulqiModule } from './culqi/culqi.module';
import { PaymentModule } from './payment/payment.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => databaseConfig,
    }),
    PaymentModule,
    CommonModule,
    CulqiModule,
  ],

  controllers: [],
  providers: [],
})
export class AppModule {}
