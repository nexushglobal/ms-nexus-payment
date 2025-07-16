import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  RpcException,
  Transport,
} from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { envs } from 'src/config/envs';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private readonly usersClient: ClientProxy;

  constructor() {
    this.usersClient = ClientProxyFactory.create({
      transport: Transport.NATS,
      options: {
        servers: [envs.NATS_SERVERS],
      },
    });
  }

  async getUserById(userId: string): Promise<{
    id: string;
    email: string;
    fullName: string;
    phone?: string;
    documentNumber?: string;
  }> {
    try {
      const userInfo = await firstValueFrom(
        this.usersClient.send({ cmd: 'user.getUserDetailedInfo' }, { userId }),
      );

      if (!userInfo) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: 'Usuario no encontrado',
        });
      }

      return userInfo;
    } catch (error) {
      this.logger.error(
        `Error al obtener información del usuario ${userId}: ${error.message}`,
      );
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al obtener información del usuario',
      });
    }
  }

  async onModuleDestroy() {
    await this.usersClient.close();
  }
}
