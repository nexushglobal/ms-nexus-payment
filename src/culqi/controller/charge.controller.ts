import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CaptureChargeDto,
  ChargeResponse,
  CreateChargeDto,
  CulqiCharge3DSResponse,
  GetChargeDto,
  GetUserChargesDto,
  UpdateChargeRequestDto,
} from '../interfaces/charge.interface';
import { ChargeService } from '../services/charge.service';

@Controller()
export class ChargeController {
  private readonly logger = new Logger(ChargeController.name);

  constructor(private readonly chargeService: ChargeService) {}

  @MessagePattern({ cmd: 'culqi.createCharge' })
  async createCharge(
    @Payload() createChargeDto: CreateChargeDto,
  ): Promise<ChargeResponse | CulqiCharge3DSResponse> {
    this.logger.log(
      `📨 Recibida solicitud de creación de charge para usuario: ${createChargeDto.userId} - Monto: ${createChargeDto.amount} ${createChargeDto.currencyCode}`,
    );

    return this.chargeService.createCharge(createChargeDto);
  }

  @MessagePattern({ cmd: 'culqi.getCharge' })
  async getCharge(
    @Payload() getChargeDto: GetChargeDto,
  ): Promise<ChargeResponse> {
    this.logger.log(
      `📨 Recibida solicitud de consulta de charge: ${getChargeDto.chargeId}`,
    );

    return this.chargeService.getCharge(
      getChargeDto.chargeId,
      getChargeDto.userId,
    );
  }

  @MessagePattern({ cmd: 'culqi.getUserCharges' })
  async getUserCharges(
    @Payload() getUserChargesDto: GetUserChargesDto,
  ): Promise<ChargeResponse[]> {
    this.logger.log(
      `📨 Recibida solicitud de consulta de charges para usuario: ${getUserChargesDto.userId}`,
    );

    return this.chargeService.getUserCharges(getUserChargesDto);
  }

  @MessagePattern({ cmd: 'culqi.updateCharge' })
  async updateCharge(
    @Payload() updateChargeDto: UpdateChargeRequestDto,
  ): Promise<ChargeResponse> {
    this.logger.log(
      `📨 Recibida solicitud de actualización de charge: ${updateChargeDto.chargeId}`,
    );

    return this.chargeService.updateCharge(
      updateChargeDto.chargeId,
      updateChargeDto.data,
    );
  }

  @MessagePattern({ cmd: 'culqi.captureCharge' })
  async captureCharge(
    @Payload() captureChargeDto: CaptureChargeDto,
  ): Promise<ChargeResponse> {
    this.logger.log(
      `📨 Recibida solicitud de captura de charge: ${captureChargeDto.chargeId}`,
    );

    return this.chargeService.captureCharge(captureChargeDto.chargeId);
  }
}
