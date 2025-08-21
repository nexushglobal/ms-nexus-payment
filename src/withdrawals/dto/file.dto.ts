import {
  IsInt,
  IsMimeType,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
} from 'class-validator';

export class FileDto {
  @IsOptional()
  @IsString()
  fieldname?: string;

  @IsNotEmpty({ message: 'El nombre original del archivo es requerido' })
  @IsString()
  originalname: string;

  @IsOptional()
  @IsString()
  encoding?: string;

  @IsNotEmpty({ message: 'El tipo MIME es requerido' })
  @IsMimeType({ message: 'El tipo MIME no es válido' })
  mimetype: string;

  @IsNotEmpty({ message: 'El tamaño del archivo es requerido' })
  @IsInt({ message: 'El tamaño debe ser un número entero' })
  @Max(5 * 1024 * 1024, { message: 'El archivo no puede ser mayor a 5MB' })
  size: number;

  @IsNotEmpty({ message: 'El buffer del archivo es requerido' })
  buffer: any;
}
