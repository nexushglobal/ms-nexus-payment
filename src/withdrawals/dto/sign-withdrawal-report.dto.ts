import { Transform, Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';
import { FileDto } from './file.dto';

export class SignWithdrawalReportDto {
  @IsNotEmpty({ message: 'El ID del retiro es requerido' })
  @IsNumber({}, { message: 'El ID del retiro debe ser numérico' })
  @Transform(({ value }) => parseInt(value as string))
  withdrawalId: number;

  @IsNotEmpty({ message: 'El número de documento del usuario es requerido' })
  @IsString()
  userDocumentNumber: string;

  @IsNotEmpty({ message: 'La razon social del usuario es requerida' })
  @IsString()
  userRazonSocial: string;

  @IsNotEmpty({ message: 'El archivo es requerido' })
  @ValidateNested()
  @Type(() => FileDto)
  file: FileDto;
}
