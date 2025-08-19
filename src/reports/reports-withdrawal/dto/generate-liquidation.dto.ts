import { IsNotEmpty, IsNumber } from 'class-validator';

export class GenerateLiquidationDto {
  @IsNumber({}, { message: 'El ID del retiro es numérico' })
  @IsNotEmpty({ message: 'El ID del retiro es obligatorio' })
  withdrawalId: number;

  @IsNotEmpty({ message: 'El número de documento del usuario es obligatorio' })
  userDocumentNumber: string;
}
