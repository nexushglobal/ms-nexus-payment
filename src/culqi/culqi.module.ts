import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { envs } from 'src/config/envs';
import { NATS_SERVICE, USERS_SERVICE } from 'src/config/services';
import { CardController } from './controller/card.controller';
import { ChargeController } from './controller/charge.controller';
import { CustomerController } from './controller/customer.controller';
import { PlanController } from './controller/plan.controller';
import { SubscriptionController } from './controller/suscription.controller';
import { CulqiController } from './culqi.controller';
import { CulqiCard } from './entities/culqi-card.entity';
import { CulqiCharge } from './entities/culqi-charge.entity';
import { CulqiCustomer } from './entities/culqi-customer.entity';
import { CulqiSubscription } from './entities/culqi-suscription';
import { CulqiPlan } from './entities/culqui-plan.entity';
import { CardService } from './services/card.service';
import { ChargeService } from './services/charge.service';
import { CulqiHttpService } from './services/culqi-http.service';
import { CustomerService } from './services/customer.service';
import { PlanService } from './services/plan.service';
import { SubscriptionService } from './services/suscription.service';
import { TokenService } from './services/token.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CulqiCustomer,
      CulqiCard,
      CulqiCharge,
      CulqiPlan,
      CulqiSubscription,
    ]),
    ClientsModule.register([
      {
        name: NATS_SERVICE,
        transport: Transport.NATS,
        options: {
          servers: envs.NATS_SERVERS,
        },
      },
      {
        name: USERS_SERVICE,
        transport: Transport.NATS,
        options: {
          servers: envs.NATS_SERVERS,
        },
      },
    ]),
  ],
  controllers: [
    CulqiController,
    CustomerController,
    CardController,
    ChargeController,
    PlanController,
    SubscriptionController,
  ],
  providers: [
    CulqiHttpService,
    TokenService,
    CustomerService,
    CardService,
    ChargeService,
    PlanService,
    SubscriptionService,
  ],
  exports: [
    CulqiHttpService,
    TokenService,
    CustomerService,
    CardService,
    ChargeService,
    PlanService,
    SubscriptionService,
    TypeOrmModule,
  ],
})
export class CulqiModule {}
