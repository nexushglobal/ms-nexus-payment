import { Injectable, Logger } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { envs } from 'src/config/envs';
import { UploadImagesResponseDto } from '../dto/upload-product-images.dto';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly filesClient: ClientProxy;
  constructor() {
    this.filesClient = ClientProxyFactory.create({
      transport: Transport.NATS,
      options: {
        servers: [envs.NATS_SERVERS],
      },
    });
  }

  async uploadImage(
    file: Express.Multer.File,
    folder?: string,
  ): Promise<UploadImagesResponseDto> {
    const payload = {
      file: {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      folder,
    };
    return await firstValueFrom(
      this.filesClient.send({ cmd: 'integration.files.upload' }, payload),
    );
  }

  async deleteImage(key: string) {
    return await firstValueFrom(
      this.filesClient.send({ cmd: 'integration.files.delete' }, { key }),
    );
  }
}
