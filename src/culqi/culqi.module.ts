import { Module } from '@nestjs/common';
import { CulqiController } from './culqi.controller';
import { CulqiHttpService } from './services/culqi-http.service';
import { TokenService } from './services/token.service';

@Module({
  controllers: [CulqiController],
  providers: [CulqiHttpService, TokenService],
})
export class CulqiModule {}
