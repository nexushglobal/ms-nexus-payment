import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CulqiCustomer } from '../entities/culqi-customer.entity';

import { firstValueFrom } from 'rxjs';
import { USERS_SERVICE } from 'src/config/services';
import { CulqiCard } from '../entities/culqi-card.entity';
import {
  CreateCulqiCustomerRequest,
  CreateCustomerDto,
  CulqiCustomerDeleteResponse,
  CulqiCustomer as CulqiCustomerInterface,
  CustomerResponse,
  UpdateCulqiCustomerRequest,
  UpdateCustomerDto,
} from '../interfaces/customer.interface';
import { CulqiHttpService } from './culqi-http.service';

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);
  constructor(
    @InjectRepository(CulqiCustomer)
    private readonly culqiCustomerRepository: Repository<CulqiCustomer>,
    @InjectRepository(CulqiCard)
    private readonly culqiCardRepository: Repository<CulqiCard>,
    private readonly culqiHttpService: CulqiHttpService,
    @Inject(USERS_SERVICE) private readonly usersClient: ClientProxy,
  ) {}

  async createCustomer(data: CreateCustomerDto): Promise<CustomerResponse> {
    try {
      this.logger.log(`🔍 Creando customer para usuario: ${data.userId}`);

      const existingCustomer = await this.culqiCustomerRepository.findOne({
        where: { userId: data.userId, isActive: true },
        //cards : true, // Cargar tarjetas si existen
      });

      if (existingCustomer) {
        throw new RpcException({
          status: 400,
          message: 'El usuario ya tiene un customer de Culqi asociado',
        });
      }

      this.validateCustomerData(data);

      const culqiCustomerData: CreateCulqiCustomerRequest = {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        address: data.address,
        address_city: data.address_city,
        country_code: data.country_code,
        phone_number: data.phone_number,
        metadata: data.metadata || {},
      };

      const response =
        await this.culqiHttpService.request<CulqiCustomerInterface>({
          endpoint: '/customers',
          method: 'POST',
          body: culqiCustomerData,
        });

      const culqiCustomer = this.culqiCustomerRepository.create({
        userId: data.userId,
        userEmail: data.email,
        culqiCustomerId: response.data.id,
        metadata: data.metadata,
      });

      const savedCustomer =
        await this.culqiCustomerRepository.save(culqiCustomer);

      this.logger.log(
        `✅ Customer creado exitosamente: ${response.data.id} para usuario ${data.userId}`,
      );

      try {
        await firstValueFrom(
          this.usersClient.send(
            { cmd: 'user.profile.updateContactInfo' },
            {
              userId: data.userId,
              updateContactInfoDto: {
                phone: data.phone_number,
                address: data.address,
                address_city: data.address_city,
                country_code: data.country_code,
              },
            },
          ),
        );

        this.logger.log(
          `✅ Usuario ${data.userId} actualizado con customer de Culqi`,
        );
      } catch (error) {
        this.logger.warn(
          `⚠️ No se pudo actualizar el usuario ${data.userId} en el servicio de usuarios: ${error.message}`,
        );
      }

      return this.mapToCustomerResponse(savedCustomer, response.data);
    } catch (error) {
      this.logger.error(
        `❌ Error creando customer para usuario ${data.userId}:`,
        error,
      );

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: 500,
        message: 'Error interno creando customer',
      });
    }
  }

  async getCustomer(userId: string): Promise<CustomerResponse> {
    try {
      this.logger.log(`🔍 Consultando customer para usuario: ${userId}`);

      const culqiCustomer = await this.culqiCustomerRepository.findOne({
        where: { userId, isActive: true },
      });

      if (!culqiCustomer) {
        throw new RpcException({
          status: 404,
          message: 'Customer no encontrado para este usuario',
        });
      }

      // Obtener datos actuales del customer desde Culqi
      const response =
        await this.culqiHttpService.request<CulqiCustomerInterface>({
          endpoint: `/customers/${culqiCustomer.culqiCustomerId}`,
          method: 'GET',
        });

      this.logger.log(
        `✅ Customer encontrado: ${culqiCustomer.culqiCustomerId}`,
      );
      return this.mapToCustomerResponse(culqiCustomer, response.data);
    } catch (error) {
      this.logger.error(
        `❌ Error consultando customer para usuario ${userId}:`,
        error,
      );

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: 500,
        message: 'Error interno consultando customer',
      });
    }
  }

  async updateCustomer(
    userId: string,
    data: UpdateCustomerDto,
  ): Promise<CustomerResponse> {
    try {
      this.logger.log(`🔍 Actualizando customer para usuario: ${userId}`);

      const culqiCustomer = await this.culqiCustomerRepository.findOne({
        where: { userId, isActive: true },
      });

      if (!culqiCustomer) {
        throw new RpcException({
          status: 404,
          message: 'Customer no encontrado para este usuario',
        });
      }

      // Validar datos si se proporcionan
      if (Object.keys(data).length === 0) {
        throw new RpcException({
          status: 400,
          message: 'Debe proporcionar al menos un campo para actualizar',
        });
      }

      // Actualizar customer en Culqi
      console.log('culqiCustomer', culqiCustomer);
      console.log('data', data);
      const culqiUpdateData: UpdateCulqiCustomerRequest = {
        ...data,
      };

      const response =
        await this.culqiHttpService.request<CulqiCustomerInterface>({
          endpoint: `/customers/${culqiCustomer.culqiCustomerId}`,
          method: 'PATCH',
          body: culqiUpdateData,
        });

      // Actualizar metadata local si se proporciona
      if (data.metadata) {
        culqiCustomer.metadata = {
          ...culqiCustomer.metadata,
          ...data.metadata,
        };
        await this.culqiCustomerRepository.save(culqiCustomer);
      }

      this.logger.log(
        `✅ Customer actualizado exitosamente: ${culqiCustomer.culqiCustomerId}`,
      );

      try {
        await firstValueFrom(
          this.usersClient.send(
            { cmd: 'user.profile.updateContactInfo' },
            {
              userId: userId,
              updateContactInfoDto: {
                phone: data.phone_number,
                address: data.address,
                address_city: data.address_city,
                country_code: data.country_code,
              },
            },
          ),
        );

        this.logger.log(
          `✅ Usuario ${userId} actualizado con customer de Culqi`,
        );
      } catch (error) {
        this.logger.warn(
          `⚠️ No se pudo actualizar el usuario ${userId} en el servicio de usuarios: ${error.message}`,
        );
      }

      return this.mapToCustomerResponse(culqiCustomer, response.data);
    } catch (error) {
      this.logger.error(
        `❌ Error actualizando customer para usuario ${userId}:`,
        error,
      );

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: 500,
        message: 'Error interno actualizando customer',
      });
    }
  }

  async deleteCustomer(
    userId: string,
  ): Promise<{ deleted: boolean; message: string }> {
    try {
      this.logger.log(`🔍 Eliminando customer para usuario: ${userId}`);

      const culqiCustomer = await this.culqiCustomerRepository.findOne({
        where: { userId, isActive: true },
      });

      if (!culqiCustomer) {
        throw new RpcException({
          status: 404,
          message: 'Customer no encontrado para este usuario',
        });
      }

      // Eliminar customer en Culqi
      const response =
        await this.culqiHttpService.request<CulqiCustomerDeleteResponse>({
          endpoint: `/customers/${culqiCustomer.culqiCustomerId}`,
          method: 'DELETE',
        });

      // Soft delete en nuestra base de datos
      culqiCustomer.isActive = false;
      await this.culqiCustomerRepository.save(culqiCustomer);

      this.logger.log(
        `✅ Customer eliminado exitosamente: ${culqiCustomer.culqiCustomerId}`,
      );

      return {
        deleted: response.data.deleted,
        message: response.data.merchant_message,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error eliminando customer para usuario ${userId}:`,
        error,
      );

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: 500,
        message: 'Error interno eliminando customer',
      });
    }
  }

  /**
   * Busca un customer por ID de Culqi (uso interno)
   */
  async findByCulqiId(culqiCustomerId: string): Promise<CulqiCustomer | null> {
    return await this.culqiCustomerRepository.findOne({
      where: { culqiCustomerId, isActive: true },
    });
  }

  /**
   * Valida los datos requeridos para crear un customer
   */
  private validateCustomerData(data: CreateCustomerDto): void {
    const nameRegex = /^[^0-9±!@£$%^&*_+§¡€#¢§¶•ªº«\\<>\-?:;|=.,]{2,50}$/;

    if (!nameRegex.test(data.first_name)) {
      throw new RpcException({
        status: 400,
        message:
          'Nombre no válido. Solo se permiten caracteres alfabéticos y espacios',
      });
    }

    if (!nameRegex.test(data.last_name)) {
      throw new RpcException({
        status: 400,
        message:
          'Apellido no válido. Solo se permiten caracteres alfabéticos y espacios',
      });
    }

    if (data.address.length < 5 || data.address.length > 100) {
      throw new RpcException({
        status: 400,
        message: 'La dirección debe tener entre 5 y 100 caracteres',
      });
    }

    if (data.address_city.length < 2 || data.address_city.length > 30) {
      throw new RpcException({
        status: 400,
        message: 'La ciudad debe tener entre 2 y 30 caracteres',
      });
    }

    if (data.phone_number.length < 5 || data.phone_number.length > 15) {
      throw new RpcException({
        status: 400,
        message: 'El teléfono debe tener entre 5 y 15 caracteres',
      });
    }

    if (data.country_code.length !== 2) {
      throw new RpcException({
        status: 400,
        message: 'El código de país debe ser ISO-3166-1 (2 caracteres)',
      });
    }
  }

  private async mapToCustomerResponse(
    culqiCustomer: CulqiCustomer,
    culqiData?: CulqiCustomerInterface,
  ): Promise<CustomerResponse> {
    let cards: any = [];
    if (culqiData && culqiData.cards && culqiData.cards.length > 0) {
      const cardIds = culqiData.cards.map((card) => card.id);

      const culqiCards = await this.culqiCardRepository.find({
        where: {
          culqiCardId: In(cardIds),
          culqiCustomerCulqiId: culqiCustomer.culqiCustomerId,
          isActive: true,
        },
      });

      const cardMap = new Map(
        culqiCards.map((card) => [card.culqiCardId, card]),
      );

      cards = culqiData.cards
        .map((culqiCardData) => {
          const localCard = cardMap.get(culqiCardData.id);
          if (!localCard) return null;

          return {
            id: localCard.id,
            source_id: culqiCardData.id,
            email: culqiCardData.source.email,
            active: culqiCardData.active,
            card_type: culqiCardData.source.iin.card_type,
            card_brand: culqiCardData.source.iin.card_brand,
            last_four: culqiCardData.source.last_four,
            card_number: culqiCardData.source.card_number,
          };
        })
        .filter(Boolean); // Remover nulls
    }

    return {
      userId: culqiCustomer.userId,
      culqiCustomerId: culqiCustomer.culqiCustomerId,
      culqiData: {
        email: culqiData?.email || culqiCustomer.userEmail,
        metadata: culqiData?.metadata || {},
        firstName: culqiData?.antifraud_details?.first_name || '',
        lastName: culqiData?.antifraud_details?.last_name || '',
        address: culqiData?.antifraud_details?.address || '',
        address_city: culqiData?.antifraud_details?.address_city || '',
        country_code: culqiData?.antifraud_details?.country_code || '',
        phone: culqiData?.antifraud_details?.phone || '',
        cards: cards,
      },
    };
  }
}
