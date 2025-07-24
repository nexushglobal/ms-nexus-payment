import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import {
  CardResponse,
  CreateCardDto,
  CulqiCard3DSResponse,
  DeleteCardDto,
  GetCardDto,
  UpdateCardRequestDto,
} from '../interfaces/card.interface';
import { CardService } from '../services/card.service';

@Controller()
export class CardController {
  private readonly logger = new Logger(CardController.name);

  constructor(private readonly cardService: CardService) {}

  @MessagePattern({ cmd: 'culqi.createCard' })
  async createCard(
    @Payload() createCardDto: CreateCardDto,
  ): Promise<CardResponse | CulqiCard3DSResponse> {
    this.logger.log(
      `📨 Recibida solicitud de creación de card para usuario: ${createCardDto.userId}`,
    );

    return this.cardService.createCard(createCardDto);
  }

  @MessagePattern({ cmd: 'culqi.getCard' })
  async getCard(
    @Payload() getCardDto: GetCardDto,
  ): Promise<CardResponse | CardResponse[]> {
    this.logger.log(
      `📨 Recibida solicitud de consulta de card(s) para usuario: ${getCardDto.userId}`,
    );

    return this.cardService.getCard(
      getCardDto.userId,
      getCardDto.culqiInfo,
      getCardDto.cardId,
    );
  }

  @MessagePattern({ cmd: 'culqi.updateCard' })
  async updateCard(
    @Payload() updateCardDto: UpdateCardRequestDto,
  ): Promise<CardResponse> {
    this.logger.log(
      `📨 Recibida solicitud de actualización de card ${updateCardDto.cardId} para usuario: ${updateCardDto.userId}`,
    );

    return this.cardService.updateCard(
      updateCardDto.userId,
      updateCardDto.cardId,
      updateCardDto.data,
    );
  }

  @MessagePattern({ cmd: 'culqi.deleteCard' })
  async deleteCard(
    @Payload() deleteCardDto: DeleteCardDto,
  ): Promise<{ deleted: boolean; message: string }> {
    this.logger.log(
      `📨 Recibida solicitud de eliminación de card ${deleteCardDto.cardId} para usuario: ${deleteCardDto.userId}`,
    );

    return this.cardService.deleteCard(
      deleteCardDto.userId,
      deleteCardDto.cardId,
    );
  }
}
