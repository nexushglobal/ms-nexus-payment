import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CreateCustomerDto,
  CustomerResponse,
  UpdateCustomerDto,
} from '../interfaces/customer.interface';
import { CustomerService } from '../services/customer.service';

export interface GetCustomerDto {
  userId: string;
}

export interface UpdateCustomerRequestDto {
  userId: string;
  data: UpdateCustomerDto;
}

export interface DeleteCustomerDto {
  userId: string;
}

@Controller()
export class CustomerController {
  private readonly logger = new Logger(CustomerController.name);

  constructor(private readonly customerService: CustomerService) {}

  @MessagePattern({ cmd: 'culqi.createCustomer' })
  async createCustomer(
    @Payload() createCustomerDto: CreateCustomerDto,
  ): Promise<CustomerResponse> {
    this.logger.log(
      `📨 Recibida solicitud de creación de customer para usuario: ${createCustomerDto.userId}`,
    );

    return this.customerService.createCustomer(createCustomerDto);
  }

  @MessagePattern({ cmd: 'culqi.getCustomer' })
  async getCustomer(
    @Payload() getCustomerDto: GetCustomerDto,
  ): Promise<CustomerResponse> {
    this.logger.log(
      `📨 Recibida solicitud de consulta de customer para usuario: ${getCustomerDto.userId}`,
    );

    return this.customerService.getCustomer(getCustomerDto.userId);
  }

  @MessagePattern({ cmd: 'culqi.updateCustomer' })
  async updateCustomer(
    @Payload() updateCustomerDto: UpdateCustomerRequestDto,
  ): Promise<CustomerResponse> {
    this.logger.log(
      `📨 Recibida solicitud de actualización de customer para usuario: ${updateCustomerDto.userId}`,
    );

    return this.customerService.updateCustomer(
      updateCustomerDto.userId,
      updateCustomerDto.data,
    );
  }

  @MessagePattern({ cmd: 'culqi.deleteCustomer' })
  async deleteCustomer(
    @Payload() deleteCustomerDto: DeleteCustomerDto,
  ): Promise<{ deleted: boolean; message: string }> {
    this.logger.log(
      `📨 Recibida solicitud de eliminación de customer para usuario: ${deleteCustomerDto.userId}`,
    );

    return this.customerService.deleteCustomer(deleteCustomerDto.userId);
  }
}
