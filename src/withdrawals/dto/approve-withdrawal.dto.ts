import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class ApproveWithdrawalDto {
  @IsNumber({}, { message: 'El id del retiro es un número válido' })
  @IsNotEmpty({ message: 'El id de retiro es requerido' })
  withdrawalId: number;

  @IsString({ message: 'El ID de usuario es una cadena de texto' })
  @IsNotEmpty({ message: 'El ID de usuario es requerido' })
  reviewerId: string;

  @IsString({ message: 'El email del usuario es una cadena de texto' })
  @IsNotEmpty({ message: 'El email del usuario es requerido' })
  reviewerEmail: string;
}
