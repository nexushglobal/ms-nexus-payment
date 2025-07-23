import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, Repository } from 'typeorm';
import { CulqiCard } from '../entities/culqi-card.entity';
import { CulqiCustomer } from '../entities/culqi-customer.entity';
import { CulqiSubscription } from '../entities/culqi-suscription';
import { CulqiPlan } from '../entities/culqui-plan.entity';
import {
  CreateSubscriptionDto,
  CulqiCreateSubscriptionRequest,
  CulqiDeleteSubscriptionResponse,
  CulqiSubscriptionInterface,
  CulqiSubscriptionResponse,
  CulqiUpdateSubscriptionRequest,
  GetSubscriptionsDto,
  SubscriptionResponse,
  SubscriptionsListResponse,
  SubscriptionSummary,
  UpdateSubscriptionDto,
} from '../interfaces/suscription.interface';
import { CulqiHttpService } from './culqi-http.service';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectRepository(CulqiSubscription)
    private readonly culqiSubscriptionRepository: Repository<CulqiSubscription>,
    @InjectRepository(CulqiCustomer)
    private readonly culqiCustomerRepository: Repository<CulqiCustomer>,
    @InjectRepository(CulqiCard)
    private readonly culqiCardRepository: Repository<CulqiCard>,
    @InjectRepository(CulqiPlan)
    private readonly culqiPlanRepository: Repository<CulqiPlan>,
    private readonly culqiHttpService: CulqiHttpService,
  ) {}

  async createSubscription(
    data: CreateSubscriptionDto,
  ): Promise<SubscriptionResponse> {
    try {
      this.logger.log(`🚀 Creando suscripción para usuario: ${data.userId}`);

      // 1. Validar y obtener customer
      const culqiCustomer = await this.culqiCustomerRepository.findOne({
        where: { userId: data.userId, isActive: true },
      });

      if (!culqiCustomer) {
        throw new RpcException({
          status: 404,
          message: 'Customer no encontrado. Debe crear un customer primero.',
        });
      }

      // 2. Validar y obtener card
      const culqiCard = await this.culqiCardRepository.findOne({
        where: {
          culqiCardId: data.cardId,
          isActive: true,
          culqiCustomer: { id: culqiCustomer.id },
        },
        relations: ['culqiCustomer'],
      });

      if (!culqiCard) {
        throw new RpcException({
          status: 404,
          message: 'Tarjeta no encontrada o no pertenece al customer',
        });
      }

      // 3. Validar y obtener plan
      const culqiPlan = await this.culqiPlanRepository.findOne({
        where: [
          { culqiPlanId: data.planId, isActive: true },
          { code: data.planId.toUpperCase(), isActive: true },
        ],
      });

      if (!culqiPlan) {
        throw new RpcException({
          status: 404,
          message: 'Plan no encontrado',
        });
      }

      if (culqiPlan.status !== 1) {
        throw new RpcException({
          status: 400,
          message: 'El plan no está activo',
        });
      }

      // 4. Verificar si ya existe una suscripción activa con el mismo plan
      const existingSubscription =
        await this.culqiSubscriptionRepository.findOne({
          where: {
            userId: data.userId,
            culqiPlan: { id: culqiPlan.id },
            isActive: true,
            status: 3, // Activa
          },
        });

      if (existingSubscription) {
        throw new RpcException({
          status: 400,
          message: `Ya existe una suscripción activa para el plan: ${culqiPlan.name}`,
        });
      }

      // 5. Crear suscripción en Culqi
      const culqiSubscriptionData: CulqiCreateSubscriptionRequest = {
        card_id: data.cardId,
        plan_id: culqiPlan.culqiPlanId,
        tyc: data.termsAndConditions,
        metadata: data.metadata || {},
      };

      const response =
        await this.culqiHttpService.request<CulqiSubscriptionResponse>({
          endpoint: '/recurrent/subscriptions/create',
          method: 'POST',
          body: culqiSubscriptionData,
        });

      // 6. Guardar en nuestra base de datos
      const culqiSubscription = this.culqiSubscriptionRepository.create({
        culqiSubscriptionId: response.data.id,
        userId: data.userId,
        userEmail: data.userEmail,
        culqiCustomer,
        culqiCard,
        culqiPlan,
        status: response.data.status,
        termsAndConditions: data.termsAndConditions,
        metadata: data.metadata,
        culqiCreationDate: response.data.created_at,
      });

      const savedSubscription =
        await this.culqiSubscriptionRepository.save(culqiSubscription);

      // 7. Actualizar contador de suscripciones en el plan
      await this.updatePlanSubscriptionCount(culqiPlan.id);

      this.logger.log(
        `✅ Suscripción creada exitosamente: ${response.data.id} para usuario ${data.userId}`,
      );

      return this.mapToSubscriptionResponse(savedSubscription);
    } catch (error) {
      this.logger.error(
        `❌ Error creando suscripción para usuario ${data.userId}:`,
        error,
      );

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: 500,
        message: 'Error interno creando suscripción',
      });
    }
  }

  async getSubscription(
    subscriptionId: string,
    userId?: string,
  ): Promise<SubscriptionResponse> {
    try {
      this.logger.log(`🔍 Consultando suscripción: ${subscriptionId}`);

      const whereCondition: any = {
        culqiSubscriptionId: subscriptionId,
        isActive: true,
      };

      if (userId) {
        whereCondition.userId = userId;
      }

      const culqiSubscription = await this.culqiSubscriptionRepository.findOne({
        where: whereCondition,
        relations: ['culqiCustomer', 'culqiCard', 'culqiPlan'],
      });

      if (!culqiSubscription) {
        throw new RpcException({
          status: 404,
          message: 'Suscripción no encontrada',
        });
      }

      // Obtener datos actuales de la suscripción desde Culqi
      const response =
        await this.culqiHttpService.request<CulqiSubscriptionInterface>({
          endpoint: `/recurrent/subscriptions/${culqiSubscription.culqiSubscriptionId}`,
          method: 'GET',
        });

      // Actualizar datos locales si es necesario
      await this.updateLocalSubscriptionData(culqiSubscription, response.data);

      this.logger.log(`✅ Suscripción encontrada: ${subscriptionId}`);

      return this.mapToSubscriptionResponse(culqiSubscription, response.data);
    } catch (error) {
      this.logger.error(
        `❌ Error consultando suscripción ${subscriptionId}:`,
        error,
      );

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: 500,
        message: 'Error interno consultando suscripción',
      });
    }
  }

  async getSubscriptions(
    filters: GetSubscriptionsDto = {},
  ): Promise<SubscriptionsListResponse> {
    try {
      this.logger.log('🔍 Consultando lista de suscripciones');

      // Construir filtros para la consulta local
      const queryBuilder = this.culqiSubscriptionRepository
        .createQueryBuilder('subscription')
        .leftJoinAndSelect('subscription.culqiCustomer', 'customer')
        .leftJoinAndSelect('subscription.culqiCard', 'card')
        .leftJoinAndSelect('subscription.culqiPlan', 'plan')
        .where('subscription.isActive = :isActive', { isActive: true });

      if (filters.userId) {
        queryBuilder.andWhere('subscription.userId = :userId', {
          userId: filters.userId,
        });
      }

      if (filters.planId) {
        queryBuilder.andWhere(
          '(plan.culqiPlanId = :planId OR plan.code = :planCode)',
          {
            planId: filters.planId,
            planCode: filters.planId.toUpperCase(),
          },
        );
      }

      if (filters.status) {
        queryBuilder.andWhere('subscription.status = :status', {
          status: filters.status,
        });
      }

      if (filters.creationDateFrom) {
        queryBuilder.andWhere('subscription.culqiCreationDate >= :dateFrom', {
          dateFrom: filters.creationDateFrom,
        });
      }

      if (filters.creationDateTo) {
        queryBuilder.andWhere('subscription.culqiCreationDate <= :dateTo', {
          dateTo: filters.creationDateTo,
        });
      }

      // Aplicar ordenamiento y límites
      queryBuilder
        .orderBy('subscription.createdAt', 'DESC')
        .limit(filters.limit || 50);

      const subscriptions = await queryBuilder.getMany();

      // Obtener información actualizada de Culqi para las primeras 10
      const subscriptionResponses = await Promise.all(
        subscriptions.slice(0, 10).map(async (subscription) => {
          try {
            const response =
              await this.culqiHttpService.request<CulqiSubscriptionInterface>({
                endpoint: `/recurrent/subscriptions/${subscription.culqiSubscriptionId}`,
                method: 'GET',
              });
            await this.updateLocalSubscriptionData(subscription, response.data);
            return this.mapToSubscriptionResponse(subscription, response.data);
          } catch (error) {
            this.logger.warn(
              `Error obteniendo datos de suscripción ${subscription.culqiSubscriptionId}:`,
              error,
            );
            return this.mapToSubscriptionResponse(subscription);
          }
        }),
      );

      // Para las restantes, solo mapear datos locales
      const remainingSubscriptions = subscriptions
        .slice(10)
        .map((subscription) => this.mapToSubscriptionResponse(subscription));

      const allSubscriptions = [
        ...subscriptionResponses,
        ...remainingSubscriptions,
      ];

      this.logger.log(
        `✅ Encontradas ${allSubscriptions.length} suscripciones`,
      );

      return {
        data: allSubscriptions,
        total: allSubscriptions.length,
      };
    } catch (error) {
      this.logger.error('❌ Error consultando suscripciones:', error);

      throw new RpcException({
        status: 500,
        message: 'Error interno consultando suscripciones',
      });
    }
  }

  async updateSubscription(
    subscriptionId: string,
    data: UpdateSubscriptionDto,
    userId?: string,
  ): Promise<SubscriptionResponse> {
    try {
      this.logger.log(`🔄 Actualizando suscripción: ${subscriptionId}`);

      const whereCondition: any = {
        culqiSubscriptionId: subscriptionId,
        isActive: true,
      };

      if (userId) {
        whereCondition.userId = userId;
      }

      const culqiSubscription = await this.culqiSubscriptionRepository.findOne({
        where: whereCondition,
        relations: ['culqiCustomer', 'culqiCard', 'culqiPlan'],
      });

      if (!culqiSubscription) {
        throw new RpcException({
          status: 404,
          message: 'Suscripción no encontrada',
        });
      }

      if (!culqiSubscription.canBeCancelled()) {
        throw new RpcException({
          status: 400,
          message: 'La suscripción no puede ser modificada en su estado actual',
        });
      }

      // Validar datos para actualizar
      if (Object.keys(data).length === 0) {
        throw new RpcException({
          status: 400,
          message: 'Debe proporcionar al menos un campo para actualizar',
        });
      }

      // Preparar datos para Culqi
      const culqiUpdateData: CulqiUpdateSubscriptionRequest = {};

      if (data.cardId) {
        // Validar que la nueva tarjeta pertenezca al customer
        const newCard = await this.culqiCardRepository.findOne({
          where: {
            culqiCardId: data.cardId,
            isActive: true,
            culqiCustomer: { id: culqiSubscription.culqiCustomer.id },
          },
        });

        if (!newCard) {
          throw new RpcException({
            status: 404,
            message:
              'La nueva tarjeta no encontrada o no pertenece al customer',
          });
        }

        culqiUpdateData.card_id = data.cardId;
        culqiSubscription.culqiCard = newCard;
      }

      if (data.metadata) {
        culqiUpdateData.metadata = data.metadata;
        culqiSubscription.metadata = {
          ...culqiSubscription.metadata,
          ...data.metadata,
        };
      }

      // Actualizar en Culqi
      const response =
        await this.culqiHttpService.request<CulqiSubscriptionInterface>({
          endpoint: `/recurrent/subscriptions/${culqiSubscription.culqiSubscriptionId}`,
          method: 'PATCH',
          body: culqiUpdateData,
        });

      const updatedSubscription =
        await this.culqiSubscriptionRepository.save(culqiSubscription);

      this.logger.log(
        `✅ Suscripción actualizada exitosamente: ${subscriptionId}`,
      );

      return this.mapToSubscriptionResponse(updatedSubscription, response.data);
    } catch (error) {
      this.logger.error(
        `❌ Error actualizando suscripción ${subscriptionId}:`,
        error,
      );

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: 500,
        message: 'Error interno actualizando suscripción',
      });
    }
  }

  async cancelSubscription(
    subscriptionId: string,
    userId?: string,
  ): Promise<{ deleted: boolean; message: string }> {
    try {
      this.logger.log(`🗑️ Cancelando suscripción: ${subscriptionId}`);

      const whereCondition: any = {
        culqiSubscriptionId: subscriptionId,
        isActive: true,
      };

      if (userId) {
        whereCondition.userId = userId;
      }

      const culqiSubscription = await this.culqiSubscriptionRepository.findOne({
        where: whereCondition,
        relations: ['culqiPlan'],
      });

      if (!culqiSubscription) {
        throw new RpcException({
          status: 404,
          message: 'Suscripción no encontrada',
        });
      }

      if (!culqiSubscription.canBeCancelled()) {
        throw new RpcException({
          status: 400,
          message: 'La suscripción no puede ser cancelada en su estado actual',
        });
      }

      // Cancelar en Culqi
      const response =
        await this.culqiHttpService.request<CulqiDeleteSubscriptionResponse>({
          endpoint: `/recurrent/subscriptions/${culqiSubscription.culqiSubscriptionId}`,
          method: 'DELETE',
        });

      // Actualizar estado local
      culqiSubscription.status = 4; // Cancelada
      culqiSubscription.cancellationDate = Math.floor(Date.now() / 1000);
      culqiSubscription.isActive = false;
      await this.culqiSubscriptionRepository.save(culqiSubscription);

      // Actualizar contador de suscripciones en el plan
      await this.updatePlanSubscriptionCount(culqiSubscription.culqiPlan.id);

      this.logger.log(
        `✅ Suscripción cancelada exitosamente: ${subscriptionId}`,
      );

      return {
        deleted: true,
        message:
          response.data.merchant_message ||
          `Suscripción ${subscriptionId} cancelada exitosamente`,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error cancelando suscripción ${subscriptionId}:`,
        error,
      );

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: 500,
        message: 'Error interno cancelando suscripción',
      });
    }
  }

  async getUserSubscriptions(userId: string): Promise<SubscriptionResponse[]> {
    try {
      this.logger.log(`🔍 Consultando suscripciones del usuario: ${userId}`);

      const subscriptions = await this.culqiSubscriptionRepository.find({
        where: { userId, isActive: true },
        relations: ['culqiCustomer', 'culqiCard', 'culqiPlan'],
        order: { createdAt: 'DESC' },
      });

      return subscriptions.map((subscription) =>
        this.mapToSubscriptionResponse(subscription),
      );
    } catch (error) {
      this.logger.error(
        `❌ Error consultando suscripciones del usuario ${userId}:`,
        error,
      );

      throw new RpcException({
        status: 500,
        message: 'Error interno consultando suscripciones del usuario',
      });
    }
  }

  async getSubscriptionSummary(): Promise<SubscriptionSummary> {
    try {
      this.logger.log('📊 Generando resumen de suscripciones');

      const totalSubscriptions = await this.culqiSubscriptionRepository.count({
        where: { isActive: true },
      });

      const activeSubscriptions = await this.culqiSubscriptionRepository.count({
        where: { isActive: true, status: 3 },
      });

      const trialSubscriptions = await this.culqiSubscriptionRepository.count({
        where: { isActive: true, status: 2 },
      });

      const cancelledSubscriptions =
        await this.culqiSubscriptionRepository.count({
          where: { status: 4 },
        });

      // Calcular ingresos del mes actual (simulado - en producción usar charges)
      const startOfMonth = Math.floor(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() /
          1000,
      );
      const endOfMonth = Math.floor(
        new Date(
          new Date().getFullYear(),
          new Date().getMonth() + 1,
          0,
        ).getTime() / 1000,
      );

      const monthlySubscriptions = await this.culqiSubscriptionRepository.find({
        where: {
          isActive: true,
          status: 3,
          culqiCreationDate: Between(startOfMonth, endOfMonth),
        },
        relations: ['culqiPlan'],
      });

      const revenueThisMonth = monthlySubscriptions.reduce(
        (total, sub) => total + sub.culqiPlan.amount,
        0,
      );

      // Próximas facturaciones (próximos 30 días)
      const nextMonth = Math.floor(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).getTime() / 1000,
      );
      const upcomingBillings = await this.culqiSubscriptionRepository.find({
        where: {
          isActive: true,
          status: 3,
          nextBillingDate: LessThanOrEqual(nextMonth),
        },
        relations: ['culqiPlan'],
        order: { nextBillingDate: 'ASC' },
        take: 10,
      });

      const nextBillings = upcomingBillings.map((sub) => ({
        subscriptionId: sub.culqiSubscriptionId,
        userId: sub.userId,
        planName: sub.culqiPlan.name,
        amount: sub.culqiPlan.amount,
        nextBillingDate: sub.nextBillingDate,
      }));

      return {
        totalSubscriptions,
        activeSubscriptions,
        trialSubscriptions,
        cancelledSubscriptions,
        revenueThisMonth,
        nextBillings,
      };
    } catch (error) {
      this.logger.error('❌ Error generando resumen de suscripciones:', error);

      throw new RpcException({
        status: 500,
        message: 'Error interno generando resumen',
      });
    }
  }

  // Métodos privados de utilidad

  private async updatePlanSubscriptionCount(planId: number): Promise<void> {
    try {
      const activeCount = await this.culqiSubscriptionRepository.count({
        where: {
          culqiPlan: { id: planId },
          isActive: true,
          status: 3, // Solo activas
        },
      });

      await this.culqiPlanRepository.update(planId, {
        totalSubscriptions: activeCount,
      });
    } catch (error) {
      this.logger.warn(
        `Error actualizando contador de suscripciones del plan ${planId}:`,
        error,
      );
    }
  }

  private async updateLocalSubscriptionData(
    localSubscription: CulqiSubscription,
    culqiData: CulqiSubscriptionInterface,
  ): Promise<void> {
    let hasChanges = false;

    if (localSubscription.status !== culqiData.status) {
      localSubscription.status = culqiData.status;
      hasChanges = true;
    }

    if (localSubscription.currentPeriod !== culqiData.current_period) {
      localSubscription.currentPeriod = culqiData.current_period;
      hasChanges = true;
    }

    if (localSubscription.nextBillingDate !== culqiData.next_billing_date) {
      localSubscription.nextBillingDate = culqiData.next_billing_date;
      hasChanges = true;
    }

    if (
      culqiData.trial_start &&
      localSubscription.trialStart !== culqiData.trial_start
    ) {
      localSubscription.trialStart = culqiData.trial_start;
      hasChanges = true;
    }

    if (
      culqiData.trial_end &&
      localSubscription.trialEnd !== culqiData.trial_end
    ) {
      localSubscription.trialEnd = culqiData.trial_end;
      hasChanges = true;
    }

    if (hasChanges) {
      await this.culqiSubscriptionRepository.save(localSubscription);
    }
  }

  private mapToSubscriptionResponse(
    subscription: CulqiSubscription,
    culqiData?: CulqiSubscriptionInterface,
  ): SubscriptionResponse {
    return {
      id: subscription.culqiSubscriptionId,
      localId: subscription.id,
      userId: subscription.userId,
      userEmail: subscription.userEmail,
      customer: {
        id: subscription.culqiCustomer.culqiCustomerId,
        // firstName: subscription.culqiCustomer.,
        // lastName: subscription.culqiCustomer.lastName,
        email: subscription.culqiCustomer.userEmail,
      },
      card: {
        id: subscription.culqiCard.culqiCardId,
        lastFour: subscription.culqiCard.lastFour,
        cardBrand: subscription.culqiCard.cardBrand,
        cardType: subscription.culqiCard.cardType,
      },
      plan: {
        id: subscription.culqiPlan.culqiPlanId,
        code: subscription.culqiPlan.code,
        name: subscription.culqiPlan.name,
        amount: subscription.culqiPlan.amount,
        currencyCode: subscription.culqiPlan.currencyCode,
        intervalUnitTime: subscription.culqiPlan.intervalUnitTime,
        intervalUnitText: subscription.culqiPlan.getIntervalText(),
      },
      status: culqiData?.status ?? subscription.status,
      statusText: subscription.getStatusText(),
      currentPeriod: culqiData?.current_period ?? subscription.currentPeriod,
      totalPeriods: subscription.totalPeriods,
      nextBillingDate:
        culqiData?.next_billing_date ?? subscription.nextBillingDate,
      trialStart: culqiData?.trial_start ?? subscription.trialStart,
      trialEnd: culqiData?.trial_end ?? subscription.trialEnd,
      isInTrialPeriod: subscription.isInTrialPeriod(),
      creationDate: culqiData?.creation_date ?? subscription.culqiCreationDate,
      cancellationDate: subscription.cancellationDate,
      termsAndConditions: subscription.termsAndConditions,
      metadata: subscription.metadata,
      isActive: subscription.isActive,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };
  }
}
