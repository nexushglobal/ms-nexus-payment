import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { envs } from '../../config/envs';
import {
  CulqiHttpOptions,
  CulqiHttpResponse,
} from '../interfaces/culqi.interface';

@Injectable()
export class CulqiHttpService {
  private readonly logger = new Logger(CulqiHttpService.name);
  private readonly baseUrl = 'https://api.culqi.com/v2';

  /**
   * Método centralizado para hacer peticiones a la API de Culqi
   */
  async request<T = any>(
    options: CulqiHttpOptions,
  ): Promise<CulqiHttpResponse<T>> {
    const { endpoint, method = 'GET', body, usePublicKey = false } = options;

    try {
      const url = `${this.baseUrl}${endpoint}`;
      const apiKey = usePublicKey ? envs.PK_CULQUI : envs.SK_CULQUI;

      this.logger.log(
        `🌐 ${method} ${endpoint} - Key: ${usePublicKey ? 'PUBLIC' : 'SECRET'}`,
      );

      const requestOptions: RequestInit = {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      };

      if (body && (method === 'POST' || method === 'PATCH')) {
        requestOptions.body = JSON.stringify(body);
        this.logger.debug(`📤 Request body:`, body);
      }

      const response = await fetch(url, requestOptions);
      const trackingId = response.headers.get('x-culqi-tracking-id');

      this.logger.log(
        `📈 Response ${response.status} - Tracking ID: ${trackingId}`,
      );

      if (!response.ok) {
        await this.handleErrorResponse(response, trackingId, endpoint);
      }

      const data: T = await response.json();

      return {
        data,
        trackingId,
        status: response.status,
      };
    } catch (error) {
      this.logger.error(`❌ Error en petición ${method} ${endpoint}:`, error);

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: 500,
        message: `Error interno en comunicación con Culqi: ${endpoint}`,
      });
    }
  }

  /**
   * Maneja los errores de respuesta de Culqi de forma centralizada
   */
  private async handleErrorResponse(
    response: Response,
    trackingId: string | null,
    endpoint: string,
  ): Promise<never> {
    let errorData: any = {};

    try {
      errorData = await response.json();
    } catch (parseError) {
      this.logger.error(
        '❌ Error parseando respuesta de error de Culqi:',
        parseError,
      );
    }

    const errorInfo = {
      status: response.status,
      endpoint,
      trackingId,
      culqiError: errorData,
    };

    this.logger.error(`❌ Error de Culqi:`, errorInfo);

    // Mapear errores específicos de Culqi
    switch (response.status) {
      case 400:
        throw new RpcException({
          status: 400,
          message: errorData.merchant_message || 'Petición inválida a Culqi',
          code: errorData.code,
          param: errorData.param,
        });

      case 401:
        throw new RpcException({
          status: 500,
          message: 'Error de autenticación con Culqi - Verificar llaves API',
          code: 'CULQI_AUTH_ERROR',
        });

      case 402:
        throw new RpcException({
          status: 402,
          message:
            errorData.user_message ||
            errorData.merchant_message ||
            'El pago no pudo ser procesado',
          code: errorData.code,
          decline_code: errorData.decline_code,
          charge_id: errorData.charge_id,
        });

      case 404:
        throw new RpcException({
          status: 404,
          message:
            errorData.merchant_message || 'Recurso no encontrado en Culqi',
          code: errorData.code,
        });

      case 422:
        throw new RpcException({
          status: 422,
          message: errorData.merchant_message || 'Parámetros inválidos',
          code: errorData.code,
          param: errorData.param,
        });

      case 429:
        throw new RpcException({
          status: 429,
          message:
            'Límite de peticiones excedido - Intenta nuevamente más tarde',
          code: 'RATE_LIMIT_EXCEEDED',
        });

      case 500:
      case 503:
        throw new RpcException({
          status: 503,
          message: 'Servicio de Culqi temporalmente no disponible',
          code: 'CULQI_SERVICE_UNAVAILABLE',
          trackingId,
        });

      default:
        throw new RpcException({
          status: 500,
          message: `Error desconocido de Culqi (${response.status})`,
          trackingId,
        });
    }
  }
}
