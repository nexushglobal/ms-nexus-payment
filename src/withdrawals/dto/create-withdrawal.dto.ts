import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateWithdrawalDto {
  @IsString({ message: 'El ID de usuario es una cadena de texto' })
  @IsNotEmpty({ message: 'El ID de usuario es requerido' })
  userId: string; // ID del usuario que compró (para buscar su referente)

  @IsString({ message: 'El nombre del usuario es una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre del usuario es requerido' })
  userName: string; // Nombre del usuario que compró

  @IsString({ message: 'El email del usuario es una cadena de texto' })
  @IsNotEmpty({ message: 'El email del usuario es requerido' })
  userEmail: string;

  @IsString({ message: 'El nombre del banco es una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre del banco es requerido' })
  bankName: string;

  @IsString({ message: 'La cuenta es una cadena de texto' })
  @IsNotEmpty({ message: 'La cuenta es requerida' })
  accountNumber: string;

  @IsString({ message: 'El código interbancario es una cadena de texto' })
  @IsNotEmpty({ message: 'El código interbancario es requerido' })
  cci: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser un número válido con hasta 2 decimales' },
  )
  @Min(0, { message: 'El monto no puede ser negativo' })
  @IsNotEmpty({ message: 'El monto es requerido' })
  @Type(() => Number)
  amount: number;
}
