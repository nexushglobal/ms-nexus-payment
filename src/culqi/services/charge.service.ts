import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CulqiCard } from '../entities/culqi-card.entity';
import { CulqiCharge } from '../entities/culqi-charge.entity';
import { CulqiCustomer } from '../entities/culqi-customer.entity';
import {
  ChargeResponse,
  CreateChargeDto,
  CreateCulqiChargeRequest,
  CulqiCharge3DSResponse,
  CulqiCharge as CulqiChargeInterface,
  GetUserChargesDto,
  UpdateChargeDto,
  UpdateCulqiChargeRequest,
} from '../interfaces/charge.interface';
import { CulqiHttpService } from './culqi-http.service';
import { TokenService } from './token.service';

@Injectable()
export class ChargeService {
  private readonly logger = new Logger(ChargeService.name);

  constructor(
    @InjectRepository(CulqiCharge)
    private readonly culqiChargeRepository: Repository<CulqiCharge>,
    @InjectRepository(CulqiCustomer)
    private readonly culqiCustomerRepository: Repository<CulqiCustomer>,
    @InjectRepository(CulqiCard)
    private readonly culqiCardRepository: Repository<CulqiCard>,
    private readonly culqiHttpService: CulqiHttpService,
    private readonly tokenService: TokenService,
  ) {}

  async createCharge(
    data: CreateChargeDto,
  ): Promise<ChargeResponse | CulqiCharge3DSResponse> {
    try {
      this.logger.log(`🔍 Creando charge para usuario: ${data.userId}`);

      // Validar monto mínimo
      if (data.amount < 100) {
        throw new RpcException({
          status: 400,
          message: 'El monto mínimo es 100 céntimos (1.00 PEN/USD)',
        });
      }

      // Validar source según tipo
      await this.validateSource(data.sourceId, data.sourceType, data.userId);

      // Crear charge en Culqi
      const culqiChargeData: CreateCulqiChargeRequest = {
        amount: data.amount,
        currency_code: data.currencyCode,
        email: data.userEmail,
        source_id: data.sourceId,
        capture: data.capture ?? true,
        description: data.description,
        installments: data.installments,
        metadata: data.metadata || {},
        antifraud_details: data.antifraudDetails,
      };

      const response = await this.culqiHttpService.request<
        CulqiChargeInterface | CulqiCharge3DSResponse
      >({
        endpoint: '/charges',
        method: 'POST',
        body: culqiChargeData,
      });

      // Si la respuesta es 200, significa que se requiere 3DS
      if (response.status === 200) {
        this.logger.warn(
          `🔐 Se requiere autenticación 3DS para el source: ${data.sourceId}`,
        );
        return response.data as CulqiCharge3DSResponse;
      }

      const chargeData = response.data as CulqiChargeInterface;

      // Guardar registro en nuestra base de datos
      const culqiCharge = this.culqiChargeRepository.create({
        culqiChargeId: chargeData.id,
        userId: data.userId,
        userEmail: data.userEmail,
        sourceId: data.sourceId,
        sourceType: data.sourceType,
        amount: chargeData.amount / 100, // Convertir de céntimos a decimal
        amountRefunded: chargeData.amount_refunded / 100,
        currencyCode: chargeData.currency_code,
        installments: chargeData.installments,
        isCaptured: chargeData.capture,
        isPaid: chargeData.paid,
        isDisputed: chargeData.dispute,
        fraudScore: chargeData.fraud_score,
        outcomeType: chargeData.outcome.type,
        outcomeCode: chargeData.outcome.code,
        declineCode: chargeData.outcome.decline_code,
        referenceCode: chargeData.reference_code,
        metadata: data.metadata,
        culqiCreationDate: chargeData.creation_date,
        authorizationCode: chargeData.authorization_code,
        captureDate: chargeData.capture_date
          ? new Date(chargeData.capture_date)
          : undefined,
        description: chargeData.description || '',
      });

      const savedCharge = await this.culqiChargeRepository.save(culqiCharge);

      this.logger.log(
        `✅ Charge creado exitosamente: ${chargeData.id} para usuario ${data.userId} - ${chargeData.outcome.user_message}`,
      );

      return this.mapToChargeResponse(savedCharge, chargeData);
    } catch (error) {
      this.logger.error(
        `❌ Error creando charge para usuario ${data.userId}:`,
        error,
      );

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: 500,
        message: 'Error interno creando charge',
      });
    }
  }

  async getCharge(chargeId: string, userId?: string): Promise<ChargeResponse> {
    try {
      this.logger.log(`🔍 Consultando charge: ${chargeId}`);

      const whereCondition: any = { culqiChargeId: chargeId };
      if (userId) {
        whereCondition.userId = userId;
      }

      const culqiCharge = await this.culqiChargeRepository.findOne({
        where: whereCondition,
      });

      if (!culqiCharge) {
        throw new RpcException({
          status: 404,
          message: 'Charge no encontrado',
        });
      }

      // Obtener datos actuales del charge desde Culqi
      const response =
        await this.culqiHttpService.request<CulqiChargeInterface>({
          endpoint: `/charges/${culqiCharge.culqiChargeId}`,
          method: 'GET',
        });

      // Actualizar datos locales si hay cambios
      await this.updateLocalChargeData(culqiCharge, response.data);

      this.logger.log(`✅ Charge encontrado: ${chargeId}`);

      return this.mapToChargeResponse(culqiCharge, response.data);
    } catch (error) {
      this.logger.error(`❌ Error consultando charge ${chargeId}:`, error);

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: 500,
        message: 'Error interno consultando charge',
      });
    }
  }

  async getUserCharges(data: GetUserChargesDto): Promise<ChargeResponse[]> {
    try {
      this.logger.log(`🔍 Consultando charges para usuario: ${data.userId}`);

      const charges = await this.culqiChargeRepository.find({
        where: { userId: data.userId },
        order: { createdAt: 'DESC' },
        take: data.limit || 50,
        skip: data.offset || 0,
      });

      if (charges.length === 0) {
        return [];
      }

      // Obtener datos actuales de los charges más recientes
      const chargeResponses = await Promise.all(
        charges.slice(0, 10).map(async (charge) => {
          // Solo actualizar los primeros 10
          try {
            const response =
              await this.culqiHttpService.request<CulqiChargeInterface>({
                endpoint: `/charges/${charge.culqiChargeId}`,
                method: 'GET',
              });
            await this.updateLocalChargeData(charge, response.data);
            return this.mapToChargeResponse(charge, response.data);
          } catch (error) {
            this.logger.warn(
              `Error obteniendo datos de charge ${charge.culqiChargeId}:`,
              error,
            );
            return this.mapToChargeResponse(charge);
          }
        }),
      );

      // Para los restantes, solo mapear datos locales
      const remainingCharges = charges
        .slice(10)
        .map((charge) => this.mapToChargeResponse(charge));

      return [...chargeResponses, ...remainingCharges];
    } catch (error) {
      this.logger.error(
        `❌ Error consultando charges para usuario ${data.userId}:`,
        error,
      );

      throw new RpcException({
        status: 500,
        message: 'Error interno consultando charges del usuario',
      });
    }
  }

  async updateCharge(
    chargeId: string,
    data: UpdateChargeDto,
  ): Promise<ChargeResponse> {
    try {
      this.logger.log(`🔍 Actualizando charge: ${chargeId}`);

      const culqiCharge = await this.culqiChargeRepository.findOne({
        where: { culqiChargeId: chargeId },
      });

      if (!culqiCharge) {
        throw new RpcException({
          status: 404,
          message: 'Charge no encontrado',
        });
      }

      // Validar datos si se proporcionan
      if (Object.keys(data).length === 0) {
        throw new RpcException({
          status: 400,
          message: 'Debe proporcionar al menos un campo para actualizar',
        });
      }

      // Actualizar charge en Culqi
      const culqiUpdateData: UpdateCulqiChargeRequest = {
        metadata: data.metadata,
      };

      const response =
        await this.culqiHttpService.request<CulqiChargeInterface>({
          endpoint: `/charges/${culqiCharge.culqiChargeId}`,
          method: 'PATCH',
          body: culqiUpdateData,
        });

      // Actualizar metadata local
      if (data.metadata) {
        culqiCharge.metadata = { ...culqiCharge.metadata, ...data.metadata };
        await this.culqiChargeRepository.save(culqiCharge);
      }

      this.logger.log(`✅ Charge actualizado exitosamente: ${chargeId}`);

      return this.mapToChargeResponse(culqiCharge, response.data);
    } catch (error) {
      this.logger.error(`❌ Error actualizando charge ${chargeId}:`, error);

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: 500,
        message: 'Error interno actualizando charge',
      });
    }
  }

  async captureCharge(chargeId: string): Promise<ChargeResponse> {
    try {
      this.logger.log(`🔍 Capturando charge: ${chargeId}`);

      const culqiCharge = await this.culqiChargeRepository.findOne({
        where: { culqiChargeId: chargeId },
      });

      if (!culqiCharge) {
        throw new RpcException({
          status: 404,
          message: 'Charge no encontrado',
        });
      }

      if (culqiCharge.isCaptured) {
        throw new RpcException({
          status: 400,
          message: 'El charge ya está capturado',
        });
      }

      // Capturar charge en Culqi
      const response =
        await this.culqiHttpService.request<CulqiChargeInterface>({
          endpoint: `/charges/${culqiCharge.culqiChargeId}/capture`,
          method: 'POST',
        });

      // Actualizar datos locales
      culqiCharge.isCaptured = true;
      culqiCharge.captureDate = response.data.capture_date
        ? new Date(response.data.capture_date)
        : new Date();
      await this.culqiChargeRepository.save(culqiCharge);

      this.logger.log(`✅ Charge capturado exitosamente: ${chargeId}`);

      return this.mapToChargeResponse(culqiCharge, response.data);
    } catch (error) {
      this.logger.error(`❌ Error capturando charge ${chargeId}:`, error);

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: 500,
        message: 'Error interno capturando charge',
      });
    }
  }

  /**
   * Valida que el source (token o card) sea válido y pertenezca al usuario
   */
  private async validateSource(
    sourceId: string,
    sourceType: string,
    userId: string,
  ): Promise<void> {
    if (sourceType === 'token') {
      // Validar token
      const tokenValidation = await this.tokenService.validateToken(sourceId);
      if (!tokenValidation.isValid) {
        throw new RpcException({
          status: 400,
          message: `Token inválido: ${tokenValidation.error}`,
        });
      }
    } else if (sourceType === 'card') {
      // Validar que la card pertenezca al usuario
      const culqiCard = await this.culqiCardRepository.findOne({
        where: {
          culqiCardId: sourceId,
          isActive: true,
          culqiCustomer: { userId },
        },
        relations: ['culqiCustomer'],
      });

      if (!culqiCard) {
        throw new RpcException({
          status: 404,
          message: 'Card no encontrada para el usuario especificado',
        });
      }

      console.log('culqiCard:', culqiCard);
      console.log('culqiCard.culqiCustomer:', culqiCard.culqiCustomer);
      console.log('userId:', userId);

      // Ya filtramos por userId en la consulta; no es necesario validar nuevamente
    } else {
      throw new RpcException({
        status: 400,
        message: 'Tipo de source inválido. Debe ser "token" o "card"',
      });
    }
  }

  /**
   * Actualiza los datos locales del charge con información de Culqi
   */
  private async updateLocalChargeData(
    culqiCharge: CulqiCharge,
    culqiData: CulqiChargeInterface,
  ): Promise<void> {
    const needsUpdate =
      culqiCharge.amountRefunded !== culqiData.amount_refunded / 100 ||
      culqiCharge.isCaptured !== culqiData.capture ||
      culqiCharge.isPaid !== culqiData.paid ||
      culqiCharge.isDisputed !== culqiData.dispute;

    if (needsUpdate) {
      culqiCharge.amountRefunded = culqiData.amount_refunded / 100;
      culqiCharge.isCaptured = culqiData.capture;
      culqiCharge.isPaid = culqiData.paid;
      culqiCharge.isDisputed = culqiData.dispute;

      if (culqiData.capture_date && !culqiCharge.captureDate) {
        culqiCharge.captureDate = new Date(culqiData.capture_date);
      }

      await this.culqiChargeRepository.save(culqiCharge);
    }
  }

  /**
   * Mapea los datos a la respuesta esperada
   */
  private mapToChargeResponse(
    culqiCharge: CulqiCharge,
    culqiData?: CulqiChargeInterface,
  ): ChargeResponse {
    return {
      id: culqiCharge.id,
      culqiChargeId: culqiCharge.culqiChargeId,
      userId: culqiCharge.userId,
      userEmail: culqiCharge.userEmail,
      sourceId: culqiCharge.sourceId,
      sourceType: culqiCharge.sourceType,
      amount: culqiCharge.amount,
      amountRefunded: culqiCharge.amountRefunded,
      currencyCode: culqiCharge.currencyCode,
      description: culqiCharge.description,
      installments: culqiCharge.installments,
      isCaptured: culqiCharge.isCaptured,
      isPaid: culqiCharge.isPaid,
      isDisputed: culqiCharge.isDisputed,
      fraudScore: culqiCharge.fraudScore,
      outcomeType: culqiCharge.outcomeType,
      outcomeCode: culqiCharge.outcomeCode,
      declineCode: culqiCharge.declineCode,
      referenceCode: culqiCharge.referenceCode,
      authorizationCode: culqiCharge.authorizationCode,
      metadata: culqiCharge.metadata,
      culqiCreationDate: culqiCharge.culqiCreationDate,
      captureDate: culqiCharge.captureDate,
      culqiData,
      createdAt: culqiCharge.createdAt,
      updatedAt: culqiCharge.updatedAt,
    };
  }
}
