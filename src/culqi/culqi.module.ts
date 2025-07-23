import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardController } from './controller/card.controller';
import { ChargeController } from './controller/charge.controller';
import { CustomerController } from './controller/customer.controller';
import { CulqiController } from './culqi.controller';
import { CulqiCard } from './entities/culqi-card.entity';
import { CulqiCharge } from './entities/culqi-charge.entity';
import { CulqiCustomer } from './entities/culqi-customer.entity';
import { CardService } from './services/card.service';
import { ChargeService } from './services/charge.service';
import { CulqiHttpService } from './services/culqi-http.service';
import { CustomerService } from './services/customer.service';
import { TokenService } from './services/token.service';

@Module({
  imports: [TypeOrmModule.forFeature([CulqiCustomer, CulqiCard, CulqiCharge])],
  controllers: [
    CulqiController,
    CustomerController,
    CardController,
    ChargeController,
  ],
  providers: [
    CulqiHttpService,
    TokenService,
    CustomerService,
    CardService,
    ChargeService,
  ],
  exports: [
    CulqiHttpService,
    TokenService,
    CustomerService,
    CardService,
    ChargeService,
    TypeOrmModule,
  ],
})
export class CulqiModule {}
