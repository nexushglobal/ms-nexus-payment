import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ValidateTokenResponse } from './interfaces/culqi.interface';
import { TokenService } from './services/token.service';

export interface ValidateTokenDto {
  tokenId: string;
}

export interface UpdateTokenMetadataDto {
  tokenId: string;
  metadata: Record<string, any>;
}

@Controller()
export class CulqiController {
  private readonly logger = new Logger(CulqiController.name);

  constructor(private readonly tokenService: TokenService) {}

  @MessagePattern({ cmd: 'culqi.validateToken' })
  async validateToken(
    @Payload() validateTokenDto: ValidateTokenDto,
  ): Promise<ValidateTokenResponse> {
    this.logger.log(
      `📨 Recibida solicitud de validación de token: ${validateTokenDto.tokenId}`,
    );

    return this.tokenService.validateToken(validateTokenDto.tokenId);
  }
}
