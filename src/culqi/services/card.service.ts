import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CulqiCard } from '../entities/culqi-card.entity';
import { CulqiCustomer } from '../entities/culqi-customer.entity';

import {
  CardResponse,
  CreateCardDto,
  CreateCulqiCardRequest,
  CulqiCard3DSResponse,
  CulqiCardDeleteResponse,
  CulqiCard as CulqiCardInterface,
  UpdateCardDto,
  UpdateCulqiCardRequest,
} from '../interfaces/card.interface';
import { CulqiHttpService } from './culqi-http.service';
import { TokenService } from './token.service';

@Injectable()
export class CardService {
  private readonly logger = new Logger(CardService.name);

  constructor(
    @InjectRepository(CulqiCard)
    private readonly culqiCardRepository: Repository<CulqiCard>,
    @InjectRepository(CulqiCustomer)
    private readonly culqiCustomerRepository: Repository<CulqiCustomer>,
    private readonly culqiHttpService: CulqiHttpService,
    private readonly tokenService: TokenService,
  ) {}

  async createCard(
    data: CreateCardDto,
  ): Promise<CardResponse | CulqiCard3DSResponse> {
    try {
      this.logger.log(`🔍 Creando card para usuario: ${data.userId}`);

      // Buscar el customer asociado al usuario
      const culqiCustomer = await this.culqiCustomerRepository.findOne({
        where: { userId: data.userId, isActive: true },
      });

      if (!culqiCustomer) {
        throw new RpcException({
          status: 404,
          message: 'Customer no encontrado. Debe crear un customer primero.',
        });
      }

      // Validar el token antes de crear la card
      const tokenValidation = await this.tokenService.validateToken(
        data.tokenId,
      );
      if (!tokenValidation.isValid) {
        throw new RpcException({
          status: 400,
          message: `Token inválido: ${tokenValidation.error}`,
        });
      }

      // Crear card en Culqi
      const culqiCardData: CreateCulqiCardRequest = {
        customer_id: culqiCustomer.culqiCustomerId,
        token_id: data.tokenId,
        validate: data.validate ?? true,
        metadata: data.metadata || {},
      };

      const response = await this.culqiHttpService.request<
        CulqiCardInterface | CulqiCard3DSResponse
      >({
        endpoint: '/cards',
        method: 'POST',
        body: culqiCardData,
      });

      // Si la respuesta es 200, significa que se requiere 3DS
      if (response.status === 200) {
        this.logger.warn(
          `🔐 Se requiere autenticación 3DS para el token: ${data.tokenId}`,
        );
        return response.data as CulqiCard3DSResponse;
      }

      const cardData = response.data as CulqiCardInterface;

      // Guardar relación en nuestra base de datos
      const culqiCard = this.culqiCardRepository.create({
        culqiCardId: cardData.id,
        culqiCustomer,
        culqiCustomerCulqiId: culqiCustomer.culqiCustomerId,
        tokenId: data.tokenId,
        lastFour: cardData.source.last_four,
        cardBrand: cardData.source.iin.card_brand,
        cardType: cardData.source.iin.card_type,
        metadata: data.metadata,
      });

      const savedCard = await this.culqiCardRepository.save(culqiCard);

      this.logger.log(
        `✅ Card creada exitosamente: ${cardData.id} para usuario ${data.userId}`,
      );

      return this.mapToCardResponse(savedCard, cardData);
    } catch (error) {
      this.logger.error(
        `❌ Error creando card para usuario ${data.userId}:`,
        error,
      );

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: 500,
        message: 'Error interno creando card',
      });
    }
  }

  async getCard(
    userId: string,
    cardId?: string,
  ): Promise<CardResponse | CardResponse[]> {
    try {
      this.logger.log(`🔍 Consultando card(s) para usuario: ${userId}`);

      const culqiCustomer = await this.culqiCustomerRepository.findOne({
        where: { userId, isActive: true },
      });

      if (!culqiCustomer) {
        throw new RpcException({
          status: 404,
          message: 'Customer no encontrado para este usuario',
        });
      }

      if (cardId) {
        // Buscar una card específica
        const culqiCard = await this.culqiCardRepository.findOne({
          where: {
            culqiCardId: cardId,
            culqiCustomer: { id: culqiCustomer.id },
            isActive: true,
          },
          relations: ['culqiCustomer'],
        });

        if (!culqiCard) {
          throw new RpcException({
            status: 404,
            message: 'Card no encontrada',
          });
        }

        // Obtener datos actuales de la card desde Culqi
        const response =
          await this.culqiHttpService.request<CulqiCardInterface>({
            endpoint: `/cards/${culqiCard.culqiCardId}`,
            method: 'GET',
          });

        return this.mapToCardResponse(culqiCard, response.data);
      } else {
        // Buscar todas las cards del usuario
        const culqiCards = await this.culqiCardRepository.find({
          where: {
            culqiCustomer: { id: culqiCustomer.id },
            isActive: true,
          },
          relations: ['culqiCustomer'],
        });

        if (culqiCards.length === 0) {
          return [];
        }

        // Obtener datos actuales de todas las cards
        const cardResponses = await Promise.all(
          culqiCards.map(async (culqiCard) => {
            try {
              const response =
                await this.culqiHttpService.request<CulqiCardInterface>({
                  endpoint: `/cards/${culqiCard.culqiCardId}`,
                  method: 'GET',
                });
              return this.mapToCardResponse(culqiCard, response.data);
            } catch (error) {
              this.logger.warn(
                `Error obteniendo datos de card ${culqiCard.culqiCardId}:`,
                error,
              );
              return this.mapToCardResponse(culqiCard);
            }
          }),
        );

        return cardResponses;
      }
    } catch (error) {
      this.logger.error(
        `❌ Error consultando card(s) para usuario ${userId}:`,
        error,
      );

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: 500,
        message: 'Error interno consultando card(s)',
      });
    }
  }

  async updateCard(
    userId: string,
    cardId: string,
    data: UpdateCardDto,
  ): Promise<CardResponse> {
    try {
      this.logger.log(`🔍 Actualizando card ${cardId} para usuario: ${userId}`);

      const culqiCustomer = await this.culqiCustomerRepository.findOne({
        where: { userId, isActive: true },
      });

      if (!culqiCustomer) {
        throw new RpcException({
          status: 404,
          message: 'Customer no encontrado para este usuario',
        });
      }

      const culqiCard = await this.culqiCardRepository.findOne({
        where: {
          culqiCardId: cardId,
          culqiCustomer: { id: culqiCustomer.id },
          isActive: true,
        },
        relations: ['culqiCustomer'],
      });

      if (!culqiCard) {
        throw new RpcException({
          status: 404,
          message: 'Card no encontrada',
        });
      }

      // Validar datos si se proporcionan
      if (Object.keys(data).length === 0) {
        throw new RpcException({
          status: 400,
          message: 'Debe proporcionar al menos un campo para actualizar',
        });
      }

      // Si se proporciona un nuevo token, validarlo
      if (data.tokenId) {
        const tokenValidation = await this.tokenService.validateToken(
          data.tokenId,
        );
        if (!tokenValidation.isValid) {
          throw new RpcException({
            status: 400,
            message: `Token inválido: ${tokenValidation.error}`,
          });
        }
      }

      // Actualizar card en Culqi
      const culqiUpdateData: UpdateCulqiCardRequest = {
        ...data,
      };

      const response = await this.culqiHttpService.request<CulqiCardInterface>({
        endpoint: `/cards/${culqiCard.culqiCardId}`,
        method: 'PATCH',
        body: culqiUpdateData,
      });

      // Actualizar datos locales si es necesario
      if (data.tokenId) {
        culqiCard.tokenId = data.tokenId;
        // Actualizar información de la tarjeta si cambió el token
        culqiCard.lastFour = response.data.source.last_four;
        culqiCard.cardBrand = response.data.source.iin.card_brand;
        culqiCard.cardType = response.data.source.iin.card_type;
      }

      if (data.metadata) {
        culqiCard.metadata = { ...culqiCard.metadata, ...data.metadata };
      }

      await this.culqiCardRepository.save(culqiCard);

      this.logger.log(
        `✅ Card actualizada exitosamente: ${culqiCard.culqiCardId}`,
      );

      return this.mapToCardResponse(culqiCard, response.data);
    } catch (error) {
      this.logger.error(
        `❌ Error actualizando card ${cardId} para usuario ${userId}:`,
        error,
      );

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: 500,
        message: 'Error interno actualizando card',
      });
    }
  }

  async deleteCard(
    userId: string,
    cardId: string,
  ): Promise<{ deleted: boolean; message: string }> {
    try {
      this.logger.log(`🔍 Eliminando card ${cardId} para usuario: ${userId}`);

      const culqiCustomer = await this.culqiCustomerRepository.findOne({
        where: { userId, isActive: true },
      });

      if (!culqiCustomer) {
        throw new RpcException({
          status: 404,
          message: 'Customer no encontrado para este usuario',
        });
      }

      const culqiCard = await this.culqiCardRepository.findOne({
        where: {
          culqiCardId: cardId,
          culqiCustomer: { id: culqiCustomer.id },
          isActive: true,
        },
        relations: ['culqiCustomer'],
      });

      if (!culqiCard) {
        throw new RpcException({
          status: 404,
          message: 'Card no encontrada',
        });
      }

      // Eliminar card en Culqi
      const response =
        await this.culqiHttpService.request<CulqiCardDeleteResponse>({
          endpoint: `/cards/${culqiCard.culqiCardId}`,
          method: 'DELETE',
        });

      // Soft delete en nuestra base de datos
      culqiCard.isActive = false;
      await this.culqiCardRepository.save(culqiCard);

      this.logger.log(
        `✅ Card eliminada exitosamente: ${culqiCard.culqiCardId}`,
      );

      return {
        deleted: response.data.deleted,
        message: response.data.merchant_message,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error eliminando card ${cardId} para usuario ${userId}:`,
        error,
      );

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: 500,
        message: 'Error interno eliminando card',
      });
    }
  }

  /**
   * Busca una card por ID de Culqi (uso interno)
   */
  async findByCulqiId(culqiCardId: string): Promise<CulqiCard | null> {
    return await this.culqiCardRepository.findOne({
      where: { culqiCardId, isActive: true },
      relations: ['culqiCustomer'],
    });
  }

  /**
   * Mapea los datos a la respuesta esperada
   */
  private mapToCardResponse(
    culqiCard: CulqiCard,
    culqiData?: CulqiCardInterface,
  ): CardResponse {
    return {
      id: culqiCard.id,
      culqiCardId: culqiCard.culqiCardId,
      culqiCustomerId: culqiCard.culqiCustomer.id,
      culqiCustomerCulqiId: culqiCard.culqiCustomerCulqiId,
      tokenId: culqiCard.tokenId,
      lastFour: culqiCard.lastFour,
      cardBrand: culqiCard.cardBrand,
      cardType: culqiCard.cardType,
      isActive: culqiCard.isActive,
      metadata: culqiCard.metadata,
      culqiData,
      createdAt: culqiCard.createdAt,
      updatedAt: culqiCard.updatedAt,
    };
  }
}
