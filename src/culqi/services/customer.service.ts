import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CulqiCustomer } from '../entities/culqi-customer.entity';

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
    private readonly culqiHttpService: CulqiHttpService,
  ) {}

  async createCustomer(data: CreateCustomerDto): Promise<CustomerResponse> {
    try {
      this.logger.log(`🔍 Creando customer para usuario: ${data.userId}`);

      // Verificar si ya existe un customer para este usuario
      const existingCustomer = await this.culqiCustomerRepository.findOne({
        where: { userId: data.userId, isActive: true },
      });

      if (existingCustomer) {
        throw new RpcException({
          status: 400,
          message: 'El usuario ya tiene un customer de Culqi asociado',
        });
      }

      // Validar datos requeridos
      this.validateCustomerData(data);

      // Crear customer en Culqi
      const culqiCustomerData: CreateCulqiCustomerRequest = {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.userEmail,
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

      // Guardar relación en nuestra base de datos
      const culqiCustomer = this.culqiCustomerRepository.create({
        userId: data.userId,
        userEmail: data.userEmail,
        culqiCustomerId: response.data.id,
        metadata: data.metadata,
      });

      const savedCustomer =
        await this.culqiCustomerRepository.save(culqiCustomer);

      this.logger.log(
        `✅ Customer creado exitosamente: ${response.data.id} para usuario ${data.userId}`,
      );

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

  /**
   * Mapea los datos a la respuesta esperada
   */
  private mapToCustomerResponse(
    culqiCustomer: CulqiCustomer,
    culqiData?: CulqiCustomerInterface,
  ): CustomerResponse {
    return {
      id: culqiCustomer.id,
      userId: culqiCustomer.userId,
      userEmail: culqiCustomer.userEmail,
      culqiCustomerId: culqiCustomer.culqiCustomerId,
      isActive: culqiCustomer.isActive,
      metadata: culqiCustomer.metadata,
      culqiData,
      createdAt: culqiCustomer.createdAt,
      updatedAt: culqiCustomer.updatedAt,
    };
  }
}
