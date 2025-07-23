import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CulqiPlan } from '../entities/culqui-plan.entity';
import {
  CreatePlanDto,
  CulqiCreatePlanRequest,
  CulqiDeletePlanResponse,
  CulqiPlanInterface,
  CulqiPlanResponse,
  CulqiUpdatePlanRequest,
  GetPlansDto,
  PlanResponse,
  PlansListResponse,
  UpdatePlanDto,
} from '../interfaces/plan.interface';
import { CulqiHttpService } from './culqi-http.service';

@Injectable()
export class PlanService {
  private readonly logger = new Logger(PlanService.name);

  constructor(
    @InjectRepository(CulqiPlan)
    private readonly culqiPlanRepository: Repository<CulqiPlan>,
    private readonly culqiHttpService: CulqiHttpService,
  ) {}

  async createPlan(data: CreatePlanDto): Promise<PlanResponse> {
    try {
      this.logger.log(`🚀 Creando plan: ${data.code} - ${data.name}`);

      // Validar que el código no exista
      const existingPlan = await this.culqiPlanRepository.findOne({
        where: { code: data.code.toUpperCase().trim() },
      });

      if (existingPlan) {
        throw new RpcException({
          status: 400,
          message: `Ya existe un plan con el código: ${data.code}`,
        });
      }

      // Preparar datos para Culqi API
      const culqiPlanData: CulqiCreatePlanRequest = {
        name: data.name.trim(),
        short_name: data.shortName.toLowerCase().replace(/\s+/g, '-'),
        description: data.description.trim(),
        amount: Math.round(data.amount * 100), // Convertir a céntimos
        currency: data.currencyCode || 'PEN',
        interval_unit_time: data.intervalUnitTime,
        interval_count: data.intervalCount,
        initial_cycles: {
          count: data.initialCycles?.count || 0,
          has_initial_charge: data.initialCycles?.hasInitialCharge || false,
          amount: Math.round((data.initialCycles?.amount || 0) * 100),
          interval_unit_time: data.initialCycles?.intervalUnitTime || 1,
        },
        image: data.imageUrl || '',
        metadata: data.metadata || {},
      };

      // Crear plan en Culqi
      const response = await this.culqiHttpService.request<CulqiPlanResponse>({
        endpoint: '/recurrent/plans/create',
        method: 'POST',
        body: culqiPlanData,
      });

      // Guardar en nuestra base de datos
      const culqiPlan = this.culqiPlanRepository.create({
        culqiPlanId: response.data.id,
        culqiSlug: response.data.slug,
        code: data.code.toUpperCase().trim(),
        name: data.name.trim(),
        shortName: data.shortName.toLowerCase().replace(/\s+/g, '-'),
        description: data.description.trim(),
        amount: data.amount,
        currencyCode: data.currencyCode || 'PEN',
        intervalUnitTime: data.intervalUnitTime,
        intervalCount: data.intervalCount,
        initialCyclesCount: data.initialCycles?.count || 0,
        hasInitialCharge: data.initialCycles?.hasInitialCharge || false,
        initialCyclesAmount: data.initialCycles?.amount || 0,
        initialCyclesIntervalUnitTime:
          data.initialCycles?.intervalUnitTime || 1,
        imageUrl: data.imageUrl,
        metadata: data.metadata,
        status: 1, // Activo por defecto
        totalSubscriptions: 0,
      });

      const savedPlan = await this.culqiPlanRepository.save(culqiPlan);

      this.logger.log(
        `✅ Plan creado exitosamente: ${response.data.id} - ${data.code}`,
      );

      return this.mapToPlanResponse(savedPlan);
    } catch (error) {
      this.logger.error(`❌ Error creando plan ${data.code}:`, error);

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: 500,
        message: 'Error interno creando plan',
      });
    }
  }

  async getPlan(planId: string): Promise<PlanResponse> {
    try {
      this.logger.log(`🔍 Consultando plan: ${planId}`);

      // Buscar por culqiPlanId o por código
      const culqiPlan = await this.culqiPlanRepository.findOne({
        where: [
          { culqiPlanId: planId, isActive: true },
          { code: planId.toUpperCase(), isActive: true },
        ],
      });

      if (!culqiPlan) {
        throw new RpcException({
          status: 404,
          message: 'Plan no encontrado',
        });
      }

      // Obtener datos actuales del plan desde Culqi
      const response = await this.culqiHttpService.request<CulqiPlanInterface>({
        endpoint: `/recurrent/plans/${culqiPlan.culqiPlanId}`,
        method: 'GET',
      });

      // Actualizar datos locales si es necesario
      await this.updateLocalPlanData(culqiPlan, response.data);

      this.logger.log(`✅ Plan encontrado: ${planId}`);

      return this.mapToPlanResponse(culqiPlan, response.data);
    } catch (error) {
      this.logger.error(`❌ Error consultando plan ${planId}:`, error);

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: 500,
        message: 'Error interno consultando plan',
      });
    }
  }

  async getPlans(filters: GetPlansDto = {}): Promise<PlansListResponse> {
    try {
      this.logger.log('🔍 Consultando lista de planes');

      // Construir filtros para la consulta local
      const queryBuilder = this.culqiPlanRepository
        .createQueryBuilder('plan')
        .where('plan.isActive = :isActive', { isActive: true });

      if (filters.status) {
        queryBuilder.andWhere('plan.status = :status', {
          status: filters.status,
        });
      }

      if (filters.amount) {
        queryBuilder.andWhere('plan.amount = :amount', {
          amount: filters.amount,
        });
      }

      if (filters.minAmount) {
        queryBuilder.andWhere('plan.amount >= :minAmount', {
          minAmount: filters.minAmount,
        });
      }

      if (filters.maxAmount) {
        queryBuilder.andWhere('plan.amount <= :maxAmount', {
          maxAmount: filters.maxAmount,
        });
      }

      if (filters.creationDateFrom) {
        queryBuilder.andWhere('plan.culqiCreationDate >= :dateFrom', {
          dateFrom: filters.creationDateFrom,
        });
      }

      if (filters.creationDateTo) {
        queryBuilder.andWhere('plan.culqiCreationDate <= :dateTo', {
          dateTo: filters.creationDateTo,
        });
      }

      // Aplicar ordenamiento y límites
      queryBuilder.orderBy('plan.createdAt', 'DESC').limit(filters.limit || 50);

      const plans = await queryBuilder.getMany();

      // Obtener información actualizada de Culqi para los primeros 10 planes
      const planResponses = await Promise.all(
        plans.slice(0, 10).map(async (plan) => {
          try {
            const response =
              await this.culqiHttpService.request<CulqiPlanInterface>({
                endpoint: `/recurrent/plans/${plan.culqiPlanId}`,
                method: 'GET',
              });
            await this.updateLocalPlanData(plan, response.data);
            return this.mapToPlanResponse(plan, response.data);
          } catch (error) {
            this.logger.warn(
              `Error obteniendo datos de plan ${plan.culqiPlanId}:`,
              error,
            );
            return this.mapToPlanResponse(plan);
          }
        }),
      );

      // Para los restantes, solo mapear datos locales
      const remainingPlans = plans
        .slice(10)
        .map((plan) => this.mapToPlanResponse(plan));

      const allPlans = [...planResponses, ...remainingPlans];

      this.logger.log(`✅ Encontrados ${allPlans.length} planes`);

      return {
        data: allPlans,
        total: allPlans.length,
      };
    } catch (error) {
      this.logger.error('❌ Error consultando planes:', error);

      throw new RpcException({
        status: 500,
        message: 'Error interno consultando planes',
      });
    }
  }

  async updatePlan(planId: string, data: UpdatePlanDto): Promise<PlanResponse> {
    try {
      this.logger.log(`🔄 Actualizando plan: ${planId}`);

      // Buscar plan local
      const culqiPlan = await this.culqiPlanRepository.findOne({
        where: [
          { culqiPlanId: planId, isActive: true },
          { code: planId.toUpperCase(), isActive: true },
        ],
      });

      if (!culqiPlan) {
        throw new RpcException({
          status: 404,
          message: 'Plan no encontrado',
        });
      }

      // Validar que hay datos para actualizar
      if (Object.keys(data).length === 0) {
        throw new RpcException({
          status: 400,
          message: 'Debe proporcionar al menos un campo para actualizar',
        });
      }

      // Preparar datos para Culqi
      const culqiUpdateData: CulqiUpdatePlanRequest = {};

      if (data.name) culqiUpdateData.name = data.name.trim();
      if (data.shortName) {
        culqiUpdateData.short_name = data.shortName
          .toLowerCase()
          .replace(/\s+/g, '-');
      }
      if (data.description)
        culqiUpdateData.description = data.description.trim();
      if (data.status) culqiUpdateData.status = data.status;
      if (data.imageUrl) culqiUpdateData.image = data.imageUrl;
      if (data.metadata) culqiUpdateData.metadata = data.metadata;

      // Actualizar en Culqi
      const response = await this.culqiHttpService.request<CulqiPlanInterface>({
        endpoint: `/recurrent/plans/${culqiPlan.culqiPlanId}`,
        method: 'PATCH',
        body: culqiUpdateData,
      });

      // Actualizar datos locales
      if (data.name) culqiPlan.name = data.name.trim();
      if (data.shortName) {
        culqiPlan.shortName = data.shortName.toLowerCase().replace(/\s+/g, '-');
      }
      if (data.description) culqiPlan.description = data.description.trim();
      if (data.status) culqiPlan.status = data.status;
      if (data.imageUrl) culqiPlan.imageUrl = data.imageUrl;
      if (data.metadata) {
        culqiPlan.metadata = { ...culqiPlan.metadata, ...data.metadata };
      }

      const updatedPlan = await this.culqiPlanRepository.save(culqiPlan);

      this.logger.log(`✅ Plan actualizado exitosamente: ${planId}`);

      return this.mapToPlanResponse(updatedPlan, response.data);
    } catch (error) {
      this.logger.error(`❌ Error actualizando plan ${planId}:`, error);

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: 500,
        message: 'Error interno actualizando plan',
      });
    }
  }

  async deletePlan(
    planId: string,
  ): Promise<{ deleted: boolean; message: string }> {
    try {
      this.logger.log(`🗑️ Eliminando plan: ${planId}`);

      // Buscar plan local
      const culqiPlan = await this.culqiPlanRepository.findOne({
        where: [
          { culqiPlanId: planId, isActive: true },
          { code: planId.toUpperCase(), isActive: true },
        ],
      });

      if (!culqiPlan) {
        throw new RpcException({
          status: 404,
          message: 'Plan no encontrado',
        });
      }

      // Verificar que no tenga suscripciones activas
      if (culqiPlan.totalSubscriptions > 0) {
        throw new RpcException({
          status: 400,
          message: 'No se puede eliminar un plan con suscripciones activas',
        });
      }

      // Eliminar en Culqi
      const response =
        await this.culqiHttpService.request<CulqiDeletePlanResponse>({
          endpoint: `/recurrent/plans/${culqiPlan.culqiPlanId}`,
          method: 'DELETE',
        });

      // Marcar como inactivo en lugar de eliminar físicamente
      culqiPlan.isActive = false;
      culqiPlan.status = 2; // Inactivo
      await this.culqiPlanRepository.save(culqiPlan);

      this.logger.log(`✅ Plan eliminado exitosamente: ${planId}`);

      return {
        deleted: true,
        message:
          response.data.merchant_message ||
          `Plan ${planId} eliminado exitosamente`,
      };
    } catch (error) {
      this.logger.error(`❌ Error eliminando plan ${planId}:`, error);

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: 500,
        message: 'Error interno eliminando plan',
      });
    }
  }

  // Métodos privados de utilidad

  private async updateLocalPlanData(
    localPlan: CulqiPlan,
    culqiData: CulqiPlanInterface,
  ): Promise<void> {
    let hasChanges = false;

    if (localPlan.totalSubscriptions !== culqiData.total_subscriptions) {
      localPlan.totalSubscriptions = culqiData.total_subscriptions;
      hasChanges = true;
    }

    if (localPlan.status !== culqiData.status) {
      localPlan.status = culqiData.status;
      hasChanges = true;
    }

    if (localPlan.culqiCreationDate !== culqiData.creation_date) {
      localPlan.culqiCreationDate = culqiData.creation_date;
      hasChanges = true;
    }

    if (hasChanges) {
      await this.culqiPlanRepository.save(localPlan);
    }
  }

  private mapToPlanResponse(
    plan: CulqiPlan,
    culqiData?: CulqiPlanInterface,
  ): PlanResponse {
    return {
      id: plan.culqiPlanId,
      localId: plan.id,
      code: plan.code,
      name: plan.name,
      shortName: plan.shortName,
      description: plan.description,
      amount: plan.amount,
      currencyCode: plan.currencyCode,
      intervalUnitTime: plan.intervalUnitTime,
      intervalUnitText: plan.getIntervalText(),
      intervalCount: plan.intervalCount,
      initialCycles: {
        count: plan.initialCyclesCount,
        hasInitialCharge: plan.hasInitialCharge,
        amount: plan.initialCyclesAmount,
        intervalUnitTime: plan.initialCyclesIntervalUnitTime,
      },
      imageUrl: plan.imageUrl,
      totalSubscriptions:
        culqiData?.total_subscriptions ?? plan.totalSubscriptions,
      status: culqiData?.status ?? plan.status,
      statusText: plan.getStatusText(),
      creationDate: culqiData?.creation_date ?? plan.culqiCreationDate,
      slug: plan.culqiSlug,
      metadata: plan.metadata,
      isActive: plan.isActive,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }
}
