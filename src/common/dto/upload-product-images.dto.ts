import { IsArray, IsNotEmpty } from 'class-validator';

export class UploadImagesDto {
  @IsArray({ message: 'Los archivos deben ser un array' })
  @IsNotEmpty({ message: 'Debe proporcionar al menos una imagen' })
  files: Express.Multer.File[];
}

export class UploadImagesResponseDto {
  url: string;
  key: string;
  bucket: string;
  location: string;
}
