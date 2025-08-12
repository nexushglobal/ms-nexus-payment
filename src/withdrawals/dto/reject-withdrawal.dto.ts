import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class RejectWithdrawalDto {
  @IsNumber({}, { message: 'El id del retiro es un número válido' })
  @IsNotEmpty({ message: 'El id de retiro es requerido' })
  withdrawalId: number;

  @IsString({ message: 'El ID del revisor es una cadena de texto' })
  @IsNotEmpty({ message: 'El ID del revisor es requerido' })
  reviewerId: string;

  @IsString({ message: 'El email del revisor es una cadena de texto' })
  @IsNotEmpty({ message: 'El email del revisor es requerido' })
  reviewerEmail: string;

  @IsString({ message: 'La razón de rechazo es una cadena de texto' })
  @IsNotEmpty({ message: 'La razón de rechazo es requerida' })
  rejectionReason: string;
}
