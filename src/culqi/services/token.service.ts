import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import {
  CulqiToken,
  ValidateTokenResponse,
} from '../interfaces/culqi.interface';
import { CulqiHttpService } from './culqi-http.service';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(private readonly culqiHttpService: CulqiHttpService) {}

  async validateToken(tokenId: string): Promise<ValidateTokenResponse> {
    try {
      this.logger.log(`🔍 Validando token de Culqi: ${tokenId}`);

      // Validar formato del token ID
      if (!this.isValidTokenFormat(tokenId)) {
        throw new RpcException({
          status: 400,
          message: 'Formato de token inválido',
        });
      }

      try {
        const response = await this.culqiHttpService.request<CulqiToken>({
          endpoint: `/tokens/${tokenId}`,
          method: 'GET',
        });

        const tokenData = response.data;

        // Verificar si el token está activo
        if (!tokenData.active) {
          this.logger.warn(`❌ Token inactivo: ${tokenId}`);
          return {
            isValid: false,
            error: 'Token inactivo o ya utilizado',
            trackingId: response.trackingId,
          };
        }

        this.logger.log(
          `✅ Token válido: ${tokenId} - ${tokenData.iin.card_brand} *${tokenData.last_four}`,
        );

        return {
          isValid: true,
          token: tokenData,
          trackingId: response.trackingId,
        };
      } catch (error) {
        // Si es un error 404, el token no existe
        if (error.status === 404) {
          return {
            isValid: false,
            error: 'Token no encontrado',
            trackingId: error.trackingId,
          };
        }

        // Re-lanzar otros errores
        throw error;
      }
    } catch (error) {
      this.logger.error(`❌ Error validando token ${tokenId}:`, error);

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: 500,
        message: 'Error interno validando token',
      });
    }
  }

  private isValidTokenFormat(tokenId: string): boolean {
    const tokenRegex = /^tkn_(test|live)_[a-zA-Z0-9]{16}$/;
    return tokenRegex.test(tokenId);
  }
}
