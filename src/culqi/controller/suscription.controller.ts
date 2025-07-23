import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CreateSubscriptionDto,
  GetSubscriptionsDto,
  SubscriptionResponse,
  SubscriptionsListResponse,
  SubscriptionSummary,
  UpdateSubscriptionDto,
} from '../interfaces/suscription.interface';
import { SubscriptionService } from '../services/suscription.service';

@Controller()
export class SubscriptionController {
  private readonly logger = new Logger(SubscriptionController.name);

  constructor(private readonly subscriptionService: SubscriptionService) {}

  @MessagePattern({ cmd: 'culqi.subscription.create' })
  async createSubscription(
    @Payload() data: CreateSubscriptionDto,
  ): Promise<SubscriptionResponse> {
    this.logger.log(
      `📨 Solicitud de creación de suscripción recibida para usuario: ${data.userId}`,
    );

    // Validaciones básicas
    if (!data.userId || !data.userEmail || !data.cardId || !data.planId) {
      throw new Error(
        'Faltan campos requeridos: userId, userEmail, cardId, planId',
      );
    }

    if (typeof data.termsAndConditions !== 'boolean') {
      throw new Error('termsAndConditions debe ser un valor booleano');
    }

    if (!data.termsAndConditions) {
      throw new Error('Debe aceptar los términos y condiciones');
    }

    // Validar formato de IDs
    if (!data.cardId.startsWith('crd_')) {
      throw new Error('cardId debe ser un ID válido de Culqi (crd_...)');
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.userEmail)) {
      throw new Error('Email inválido');
    }

    return await this.subscriptionService.createSubscription(data);
  }

  @MessagePattern({ cmd: 'culqi.subscription.get' })
  async getSubscription(
    @Payload() data: { subscriptionId: string; userId?: string },
  ): Promise<SubscriptionResponse> {
    this.logger.log(
      `📨 Solicitud de consulta de suscripción recibida: ${data.subscriptionId}`,
    );

    if (!data.subscriptionId) {
      throw new Error('subscriptionId es requerido');
    }

    if (!data.subscriptionId.startsWith('sxn_')) {
      throw new Error(
        'subscriptionId debe ser un ID válido de Culqi (sxn_...)',
      );
    }

    return await this.subscriptionService.getSubscription(
      data.subscriptionId,
      data.userId,
    );
  }

  @MessagePattern({ cmd: 'culqi.subscription.list' })
  async getSubscriptions(
    @Payload() filters: GetSubscriptionsDto = {},
  ): Promise<SubscriptionsListResponse> {
    this.logger.log('📨 Solicitud de lista de suscripciones recibida');

    // Validaciones de filtros opcionales
    if (filters.limit && (filters.limit < 1 || filters.limit > 100)) {
      throw new Error('El límite debe estar entre 1 y 100');
    }

    if (filters.status && (filters.status < 1 || filters.status > 6)) {
      throw new Error('El estado debe estar entre 1 y 6');
    }

    if (filters.planId) {
      // Validar si es ID de Culqi o código local
      if (
        !filters.planId.startsWith('pln_') &&
        !/^[A-Z0-9-_]+$/.test(filters.planId)
      ) {
        throw new Error(
          'planId debe ser un ID de Culqi válido o un código local válido',
        );
      }
    }

    return await this.subscriptionService.getSubscriptions(filters);
  }

  @MessagePattern({ cmd: 'culqi.subscription.update' })
  async updateSubscription(
    @Payload()
    data: { subscriptionId: string; userId?: string } & UpdateSubscriptionDto,
  ): Promise<SubscriptionResponse> {
    this.logger.log(
      `📨 Solicitud de actualización de suscripción recibida: ${data.subscriptionId}`,
    );

    if (!data.subscriptionId) {
      throw new Error('subscriptionId es requerido');
    }

    if (!data.subscriptionId.startsWith('sxn_')) {
      throw new Error(
        'subscriptionId debe ser un ID válido de Culqi (sxn_...)',
      );
    }

    // Extraer subscriptionId y userId del payload
    const { subscriptionId, userId, ...updateData } = data;

    // Validaciones opcionales
    if (updateData.cardId && !updateData.cardId.startsWith('crd_')) {
      throw new Error('cardId debe ser un ID válido de Culqi (crd_...)');
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error('Debe proporcionar al menos un campo para actualizar');
    }

    return await this.subscriptionService.updateSubscription(
      subscriptionId,
      updateData,
      userId,
    );
  }

  @MessagePattern({ cmd: 'culqi.subscription.cancel' })
  async cancelSubscription(
    @Payload() data: { subscriptionId: string; userId?: string },
  ): Promise<{ deleted: boolean; message: string }> {
    this.logger.log(
      `📨 Solicitud de cancelación de suscripción recibida: ${data.subscriptionId}`,
    );

    if (!data.subscriptionId) {
      throw new Error('subscriptionId es requerido');
    }

    if (!data.subscriptionId.startsWith('sxn_')) {
      throw new Error(
        'subscriptionId debe ser un ID válido de Culqi (sxn_...)',
      );
    }

    return await this.subscriptionService.cancelSubscription(
      data.subscriptionId,
      data.userId,
    );
  }

  @MessagePattern({ cmd: 'culqi.subscription.getUserSubscriptions' })
  async getUserSubscriptions(
    @Payload() data: { userId: string },
  ): Promise<SubscriptionResponse[]> {
    this.logger.log(
      `📨 Solicitud de suscripciones del usuario recibida: ${data.userId}`,
    );

    if (!data.userId) {
      throw new Error('userId es requerido');
    }

    return await this.subscriptionService.getUserSubscriptions(data.userId);
  }

  @MessagePattern({ cmd: 'culqi.subscription.summary' })
  async getSubscriptionSummary(): Promise<SubscriptionSummary> {
    this.logger.log('📨 Solicitud de resumen de suscripciones recibida');

    return await this.subscriptionService.getSubscriptionSummary();
  }

  @MessagePattern({ cmd: 'culqi.subscription.getByPlan' })
  async getSubscriptionsByPlan(
    @Payload() data: { planId: string; status?: number; limit?: number },
  ): Promise<SubscriptionsListResponse> {
    this.logger.log(
      `📨 Solicitud de suscripciones por plan recibida: ${data.planId}`,
    );

    if (!data.planId) {
      throw new Error('planId es requerido');
    }

    const filters: GetSubscriptionsDto = {
      planId: data.planId,
      status: data.status,
      limit: data.limit || 50,
    };

    return await this.subscriptionService.getSubscriptions(filters);
  }

  @MessagePattern({ cmd: 'culqi.subscription.getActive' })
  async getActiveSubscriptions(
    @Payload() data: { userId?: string; limit?: number } = {},
  ): Promise<SubscriptionsListResponse> {
    this.logger.log('📨 Solicitud de suscripciones activas recibida');

    const filters: GetSubscriptionsDto = {
      status: 3, // Activa
      userId: data.userId,
      limit: data.limit || 50,
    };

    return await this.subscriptionService.getSubscriptions(filters);
  }

  @MessagePattern({ cmd: 'culqi.subscription.getTrial' })
  async getTrialSubscriptions(
    @Payload() data: { userId?: string; limit?: number } = {},
  ): Promise<SubscriptionsListResponse> {
    this.logger.log(
      '📨 Solicitud de suscripciones en período de prueba recibida',
    );

    const filters: GetSubscriptionsDto = {
      status: 2, // Días de prueba
      userId: data.userId,
      limit: data.limit || 50,
    };

    return await this.subscriptionService.getSubscriptions(filters);
  }

  @MessagePattern({ cmd: 'culqi.subscription.getCancelled' })
  async getCancelledSubscriptions(
    @Payload() data: { userId?: string; limit?: number } = {},
  ): Promise<SubscriptionsListResponse> {
    this.logger.log('📨 Solicitud de suscripciones canceladas recibida');

    const filters: GetSubscriptionsDto = {
      status: 4, // Cancelada
      userId: data.userId,
      limit: data.limit || 50,
    };

    return await this.subscriptionService.getSubscriptions(filters);
  }
}
