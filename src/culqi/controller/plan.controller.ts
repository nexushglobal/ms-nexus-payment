import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CreatePlanDto,
  GetPlansDto,
  PlanResponse,
  PlansListResponse,
  UpdatePlanDto,
} from '../interfaces/plan.interface';
import { PlanService } from '../services/plan.service';

@Controller()
export class PlanController {
  private readonly logger = new Logger(PlanController.name);

  constructor(private readonly planService: PlanService) {}

  @MessagePattern({ cmd: 'culqi.plan.create' })
  async createPlan(@Payload() data: CreatePlanDto): Promise<PlanResponse> {
    this.logger.log(`📨 Solicitud de creación de plan recibida: ${data.code}`);

    // Validaciones básicas
    if (!data.code || !data.name || !data.shortName || !data.description) {
      throw new Error(
        'Faltan campos requeridos: code, name, shortName, description',
      );
    }

    if (!data.amount || data.amount <= 0) {
      throw new Error('El monto debe ser mayor a 0');
    }

    if (
      !data.intervalUnitTime ||
      ![1, 2, 3, 4, 5, 6].includes(data.intervalUnitTime)
    ) {
      throw new Error(
        'intervalUnitTime debe ser 1=Diario, 2=Semanal, 3=Mensual, 4=Anual, 5=Trimestral, 6=Semestral',
      );
    }

    if (!data.intervalCount || data.intervalCount <= 0) {
      throw new Error('intervalCount debe ser mayor a 0');
    }

    // Validar código con formato específico
    const codePattern = /^[A-Z0-9-_]+$/;
    if (!codePattern.test(data.code.toUpperCase())) {
      throw new Error(
        'El código solo puede contener letras mayúsculas, números, guiones y guiones bajos',
      );
    }

    return await this.planService.createPlan(data);
  }

  @MessagePattern({ cmd: 'culqi.plan.get' })
  async getPlan(@Payload() data: { planId: string }): Promise<PlanResponse> {
    this.logger.log(
      `📨 Solicitud de consulta de plan recibida: ${data.planId}`,
    );

    if (!data.planId) {
      throw new Error('planId es requerido');
    }

    return await this.planService.getPlan(data.planId);
  }

  @MessagePattern({ cmd: 'culqi.plan.list' })
  async getPlans(
    @Payload() filters: GetPlansDto = {},
  ): Promise<PlansListResponse> {
    this.logger.log('📨 Solicitud de lista de planes recibida');

    // Validaciones de filtros opcionales
    if (filters.limit && (filters.limit < 1 || filters.limit > 100)) {
      throw new Error('El límite debe estar entre 1 y 100');
    }

    if (filters.amount && filters.amount <= 0) {
      throw new Error('El monto debe ser mayor a 0');
    }

    if (filters.minAmount && filters.minAmount <= 0) {
      throw new Error('El monto mínimo debe ser mayor a 0');
    }

    if (filters.maxAmount && filters.maxAmount <= 0) {
      throw new Error('El monto máximo debe ser mayor a 0');
    }

    if (
      filters.minAmount &&
      filters.maxAmount &&
      filters.minAmount > filters.maxAmount
    ) {
      throw new Error('El monto mínimo no puede ser mayor al monto máximo');
    }

    if (filters.status && ![1, 2].includes(filters.status)) {
      throw new Error('El estado debe ser 1 (Activo) o 2 (Inactivo)');
    }

    return await this.planService.getPlans(filters);
  }

  @MessagePattern({ cmd: 'culqi.plan.update' })
  async updatePlan(
    @Payload() data: { planId: string } & UpdatePlanDto,
  ): Promise<PlanResponse> {
    this.logger.log(
      `📨 Solicitud de actualización de plan recibida: ${data.planId}`,
    );

    if (!data.planId) {
      throw new Error('planId es requerido');
    }

    // Extraer planId del payload
    const { planId, ...updateData } = data;

    // Validaciones opcionales
    if (updateData.status && ![1, 2].includes(updateData.status)) {
      throw new Error('El estado debe ser 1 (Activo) o 2 (Inactivo)');
    }

    if (updateData.name && updateData.name.trim().length < 5) {
      throw new Error('El nombre debe tener al menos 5 caracteres');
    }

    if (updateData.shortName && updateData.shortName.trim().length < 5) {
      throw new Error('El nombre corto debe tener al menos 5 caracteres');
    }

    if (updateData.description && updateData.description.trim().length < 5) {
      throw new Error('La descripción debe tener al menos 5 caracteres');
    }

    return await this.planService.updatePlan(planId, updateData);
  }

  @MessagePattern({ cmd: 'culqi.plan.delete' })
  async deletePlan(
    @Payload() data: { planId: string },
  ): Promise<{ deleted: boolean; message: string }> {
    this.logger.log(
      `📨 Solicitud de eliminación de plan recibida: ${data.planId}`,
    );

    if (!data.planId) {
      throw new Error('planId es requerido');
    }

    return await this.planService.deletePlan(data.planId);
  }

  @MessagePattern({ cmd: 'culqi.plan.getByCode' })
  async getPlanByCode(
    @Payload() data: { code: string },
  ): Promise<PlanResponse> {
    this.logger.log(
      `📨 Solicitud de consulta de plan por código recibida: ${data.code}`,
    );

    if (!data.code) {
      throw new Error('code es requerido');
    }

    return await this.planService.getPlan(data.code);
  }

  @MessagePattern({ cmd: 'culqi.plan.activate' })
  async activatePlan(
    @Payload() data: { planId: string },
  ): Promise<PlanResponse> {
    this.logger.log(
      `📨 Solicitud de activación de plan recibida: ${data.planId}`,
    );

    if (!data.planId) {
      throw new Error('planId es requerido');
    }

    return await this.planService.updatePlan(data.planId, { status: 1 });
  }

  @MessagePattern({ cmd: 'culqi.plan.deactivate' })
  async deactivatePlan(
    @Payload() data: { planId: string },
  ): Promise<PlanResponse> {
    this.logger.log(
      `📨 Solicitud de desactivación de plan recibida: ${data.planId}`,
    );

    if (!data.planId) {
      throw new Error('planId es requerido');
    }

    return await this.planService.updatePlan(data.planId, { status: 2 });
  }
}
