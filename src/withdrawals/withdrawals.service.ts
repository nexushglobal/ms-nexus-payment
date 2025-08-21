/* eslint-disable @typescript-eslint/no-unused-vars */
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { paginate } from 'src/common/helpers/paginate.helper';
import { PaymentService } from 'src/payment/services/payment.service';
import { ReportsWithdrawalService } from 'src/reports/reports-withdrawal/reports-withdrawal.service';
import { DataSource, Repository } from 'typeorm';
import { PointsService } from '../common/services/points.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import {
  FindOneWithdrawalWithReportResponseDto,
  PaymentInfoDto,
} from './dto/find-one-withdrawal-with-report.dto';
import { FindOneWithdrawalResponseDto } from './dto/find-one-withdrawal.dto';
import { FindWithdrawalsDto } from './dto/find-withdrawals.dto';
import { WithdrawalPoints } from './entities/wirhdrawal-points.entity';
import { Withdrawal, WithdrawalStatus } from './entities/withdrawal.entity';
import { formatCreateWithdrawalResponse } from './helpers/format-create-withdrawal-response.helper';
import { formatListWithdrawalsResponse } from './helpers/format-list-withdrawal-response.helper';
import { formatOneWithdrawalResponse } from './helpers/format-one-withdrawal-response.helper';
import { formatOneWithdrawalWithReportResponse } from './helpers/format-one-withdrawal-with-report-response.helper';

@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);

  constructor(
    @InjectRepository(Withdrawal)
    private readonly withdrawalRepository: Repository<Withdrawal>,
    @InjectRepository(WithdrawalPoints)
    private readonly withdrawalPointsRepository: Repository<WithdrawalPoints>,
    private readonly dataSource: DataSource,
    private readonly pointsService: PointsService,
    private readonly paymentService: PaymentService,
    @Inject(forwardRef(() => ReportsWithdrawalService))
    private readonly reportsWithdrawalService: ReportsWithdrawalService,
  ) {}

  async createWithdrawal(createWithdrawalDto: CreateWithdrawalDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const {
        amount,
        bankName,
        accountNumber,
        cci,
        userId,
        userEmail,
        userName,
        userDocumentNumber,
        userRazonSocial,
      } = createWithdrawalDto;

      this.logger.log(
        `Iniciando creación de retiro para usuario ${userId}, monto: ${amount}`,
      );
      const reserveForWithdrawal =
        await this.pointsService.reserveForWithdrawal(
          userId,
          userName,
          userEmail,
          amount,
        );

      if (!reserveForWithdrawal.success)
        throw new RpcException({
          status: 400,
          message: 'No tienes suficientes puntos disponibles',
        });

      // 3. Crear la solicitud de retiro con datos desnormalizados
      const withdrawal = this.withdrawalRepository.create({
        userId,
        userEmail,
        userName,
        amount,
        status: WithdrawalStatus.PENDING_SIGNATURE,
        bankName,
        accountNumber,
        cci,
        metadata: {
          createdAt: new Date(),
          requestedAmount: amount,
          'Monto solicitado': amount,
          'Puntos disponibles': amount,
        },
      });

      const savedWithdrawal = await queryRunner.manager.save(withdrawal);

      if (
        reserveForWithdrawal.pointsTransaction &&
        reserveForWithdrawal.pointsTransaction.length > 0
      ) {
        const withdrawalPointsToSave =
          reserveForWithdrawal.pointsTransaction.map((transaction) => {
            return this.withdrawalPointsRepository.create({
              withdrawal: savedWithdrawal,
              pointsTransaction: transaction.id.toString(),
              pointsAmount: transaction.amount,
              amountUsed: transaction.amountUsed,
              metadata: transaction.metadata,
            });
          });

        await queryRunner.manager.save(withdrawalPointsToSave);
      }

      await queryRunner.commitTransaction();
      await queryRunner.release();
      try {
        const pdfResult =
          await this.reportsWithdrawalService.generateLiquidation(
            savedWithdrawal.id,
            userDocumentNumber,
            userRazonSocial,
          );
        savedWithdrawal.pdfUrl = pdfResult.url;
        await this.withdrawalRepository.save(savedWithdrawal);
      } catch (pdfError) {
        this.logger.error(
          `Error al generar PDF para retiro ${savedWithdrawal.id}: ${pdfError.message}`,
        );
      }

      this.logger.log(`Retiro creado exitosamente: ${savedWithdrawal.id}`);
      return formatCreateWithdrawalResponse(savedWithdrawal);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.logger.error(`Error al crear retiro: ${error.message}`);
      if (error instanceof RpcException) throw error;
      throw new RpcException({
        status: 500,
        message: 'Error interno al crear retiro',
      });
    }
  }

  async findAllWithdrawals(filters: FindWithdrawalsDto) {
    try {
      const {
        page = 1,
        limit = 10,
        startDate,
        endDate,
        status,
        name,
        email,
      } = filters;
      const queryBuilder =
        this.withdrawalRepository.createQueryBuilder('withdrawal');
      if (status)
        queryBuilder.andWhere('withdrawal.status = :status', { status });
      if (startDate)
        queryBuilder.andWhere('withdrawal.createdAt >= :startDate', {
          startDate: new Date(startDate),
        });
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        queryBuilder.andWhere('withdrawal.createdAt <= :endDate', {
          endDate: endOfDay,
        });
      }
      if (name)
        queryBuilder.andWhere('withdrawal.userName ILIKE :name', {
          name: `%${name}%`,
        });
      if (email)
        queryBuilder.andWhere('withdrawal.userEmail ILIKE :email', {
          email: `%${email}%`,
        });
      queryBuilder.orderBy('withdrawal.createdAt', 'DESC');
      const items = await queryBuilder.getMany();
      const formattedItems = formatListWithdrawalsResponse(items);
      const paginationResponse = paginate(formattedItems, { page, limit });
      return paginationResponse;
    } catch (error) {
      this.logger.error(`Error fetching all withdrawals: ${error.message}`);
      throw new RpcException({
        status: 500,
        message: 'Error interno al obtener retiros',
      });
    }
  }

  async findOneWithdrawal(id: number): Promise<FindOneWithdrawalResponseDto> {
    try {
      const withdrawal = await this.withdrawalRepository.findOne({
        where: { id },
        relations: ['withdrawalPoints'],
      });
      if (!withdrawal)
        throw new RpcException({
          status: 404,
          message: `Retiro con ID ${id} no encontrado`,
        });
      const formattedWithdrawal = formatOneWithdrawalResponse(withdrawal);
      return formattedWithdrawal;
    } catch (error) {
      this.logger.error(`Error fetching withdrawal ${id}: ${error.message}`);
      if (error instanceof RpcException) throw error;
      throw new RpcException({
        status: 500,
        message: 'Error interno al obtener retiro',
      });
    }
  }

  async findOneWithdrawalWithReport(
    id: number,
  ): Promise<FindOneWithdrawalWithReportResponseDto> {
    try {
      const withdrawal = await this.withdrawalRepository.findOne({
        where: { id },
        relations: ['withdrawalPoints'],
      });

      if (!withdrawal)
        throw new RpcException({
          status: 404,
          message: `Retiro con ID ${id} no encontrado`,
        });
      // Obtener información de pagos para todos los withdrawal points
      const paymentsInfoMap = await this.getPaymentsInfoForWithdrawalPoints(
        withdrawal.withdrawalPoints,
      );
      const formattedWithdrawal = formatOneWithdrawalWithReportResponse(
        withdrawal,
        paymentsInfoMap,
      );

      return formattedWithdrawal;
    } catch (error) {
      this.logger.error(`Error fetching withdrawal ${id}: ${error.message}`);
      if (error instanceof RpcException) throw error;
      throw new RpcException({
        status: 500,
        message: 'Error interno al obtener retiro',
      });
    }
  }

  private async getPaymentsInfoForWithdrawalPoints(
    withdrawalPoints: WithdrawalPoints[],
  ): Promise<Map<string, PaymentInfoDto[]>> {
    const paymentsInfoMap = new Map<string, PaymentInfoDto[]>();

    for (const point of withdrawalPoints) {
      try {
        // 1. Obtener los paymentIds desde el microservicio
        const paymentIds = await this.pointsService.getPointsTransactionById(
          point.pointsTransaction,
        );
        if (paymentIds && paymentIds.length > 0) {
          // 2. Obtener la información de los pagos desde tu entidad local
          const payments =
            await this.paymentService.findByIdsWithReport(paymentIds);
          // ✅ Manejar correctamente cuando no hay payments
          if (payments && payments.length > 0) {
            // 3. Mapear a PaymentInfoDto
            const paymentsInfo: PaymentInfoDto[] = payments.map((payment) => ({
              paymentId: payment.id.toString(),
              operationCode: payment.operationCode,
              ticketNumber: payment.ticketNumber,
              paymentMethod: payment.paymentMethod,
              amount: payment.amount,
            }));
            paymentsInfoMap.set(point.pointsTransaction, paymentsInfo);
          }
        }
      } catch (error) {
        this.logger.warn(
          `Error obteniendo pagos para transactionId ${point.pointsTransaction}: ${error.message}`,
        );
        // En caso de error, agregar array vacío para no romper la respuesta
        paymentsInfoMap.set(point.pointsTransaction, []);
      }
    }
    return paymentsInfoMap;
  }

  async findUserWithdrawals(userId: string, filters: FindWithdrawalsDto) {
    try {
      const { page = 1, limit = 10, status, startDate, endDate } = filters;

      const queryBuilder = this.withdrawalRepository
        .createQueryBuilder('withdrawal')
        .where('withdrawal.userId = :userId', { userId });

      if (status)
        queryBuilder.andWhere('withdrawal.status = :status', { status });
      if (startDate)
        queryBuilder.andWhere('withdrawal.createdAt >= :startDate', {
          startDate: new Date(startDate),
        });
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        queryBuilder.andWhere('withdrawal.createdAt <= :endDate', {
          endDate: endOfDay,
        });
      }
      queryBuilder.orderBy('withdrawal.createdAt', 'DESC');

      const items = await queryBuilder.getMany();
      const itemsWithoutTimestamps = items.map(
        ({ createdAt, updatedAt, ...item }) => item,
      );
      return paginate(itemsWithoutTimestamps, { page, limit });
    } catch (error) {
      this.logger.error(
        `Error al obtener retiros del usuario: ${error.message}`,
      );
      if (error instanceof RpcException) throw error;
      throw new RpcException({
        status: 500,
        message: 'Error interno al obtener retiro',
      });
    }
  }

  async approveWithdrawal(
    withdrawalId: number,
    reviewerId: string,
    reviewerEmail: string,
    // approveWithdrawalDto: ApproveWithdrawalDto,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const withdrawal = await this.withdrawalRepository.findOne({
        where: { id: withdrawalId },
      });
      if (!withdrawal)
        throw new RpcException({
          status: 404,
          message: `Retiro con ID ${withdrawalId} no encontrado`,
        });

      if (withdrawal.status !== WithdrawalStatus.PENDING)
        throw new RpcException({
          status: 400,
          message: `El retiro ya ha sido ${withdrawal.status === WithdrawalStatus.APPROVED ? 'aprobado' : 'rechazado'}`,
        });

      const withdrawalPoints = await this.withdrawalPointsRepository.find({
        where: { withdrawal: { id: withdrawalId } },
      });

      // Actualizar el estado del retiro
      withdrawal.status = WithdrawalStatus.APPROVED;
      withdrawal.reviewedById = withdrawalId.toString();
      withdrawal.reviewedByEmail = reviewerEmail;
      withdrawal.reviewedAt = new Date();

      await queryRunner.manager.save(withdrawal);

      const withdrawalPointsWithTransactions = withdrawalPoints.map((wp) => ({
        pointsTransactionId: wp.pointsTransaction,
        amountUsed: wp.amountUsed,
      }));

      await this.pointsService.approveWithdrawal(
        withdrawalId,
        withdrawal.userId,
        reviewerId,
        reviewerEmail,
        withdrawalPointsWithTransactions,
      );
      await queryRunner.commitTransaction();
      return {
        withdrawalId: withdrawal.id,
        reviewedBy: {
          id: reviewerId,
          email: reviewerEmail,
        },
        timestamp: withdrawal.reviewedAt,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error al obtener retiros del usuario: ${error.message}`,
      );
      if (error instanceof RpcException) throw error;
      throw new RpcException({
        status: 500,
        message: 'Error interno al aprobar retiro',
      });
    } finally {
      await queryRunner.release();
    }
  }

  async rejectWithdrawal(
    withdrawalId: number,
    reviewerId: string,
    reviewerEmail: string,
    rejectionReason: string,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Buscar withdrawal sin joins
      const withdrawal = await this.withdrawalRepository.findOne({
        where: { id: withdrawalId },
      });

      if (!withdrawal) {
        throw new RpcException({
          status: 404,
          message: `Retiro con ID ${withdrawalId} no encontrado`,
        });
      }

      if (withdrawal.status !== WithdrawalStatus.PENDING) {
        throw new RpcException({
          status: 400,
          message: `El retiro ya ha sido ${withdrawal.status === WithdrawalStatus.APPROVED ? 'aprobado' : 'rechazado'}`,
        });
      }

      if (!rejectionReason) {
        throw new RpcException({
          status: 400,
          message: 'Se requiere una razón para rechazar el retiro',
        });
      }

      // 2. Obtener WithdrawalPoints para enviar al points service
      const withdrawalPoints = await this.withdrawalPointsRepository.find({
        where: { withdrawal: { id: withdrawalId } },
      });

      // 3. Actualizar estado del withdrawal
      withdrawal.status = WithdrawalStatus.REJECTED;
      withdrawal.reviewedById = reviewerId;
      withdrawal.reviewedByEmail = reviewerEmail;
      withdrawal.reviewedAt = new Date();
      withdrawal.rejectionReason = rejectionReason;

      await queryRunner.manager.save(withdrawal);

      // 4. Enviar al points service para procesar el rechazo
      await this.pointsService.rejectWithdrawal(
        withdrawalId,
        withdrawal.userId,
        withdrawal.amount,
        reviewerId,
        reviewerEmail,
        rejectionReason,
        withdrawalPoints.map((wp) => ({
          pointsTransactionId: wp.pointsTransaction,
          amountUsed: wp.amountUsed,
        })),
      );
      await queryRunner.commitTransaction();
      return {
        withdrawalId: withdrawal.id,
        rejectionReason: withdrawal.rejectionReason,
        reviewedBy: {
          id: reviewerId,
          email: reviewerEmail,
        },
        timestamp: withdrawal.reviewedAt,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error al rechazar retiro: ${error.message}`);
      if (error instanceof RpcException) throw error;
      throw new RpcException({
        status: 500,
        message: 'Error interno al rechazar retiro',
      });
    } finally {
      await queryRunner.release();
    }
  }

  async findAllReports(filters?: {
    startDate?: string;
    endDate?: string;
    userId?: string;
  }): Promise<Withdrawal[]> {
    try {
      const queryBuilder = this.withdrawalRepository
        .createQueryBuilder('withdrawal')
        .where('withdrawal.status = :status', {
          status: WithdrawalStatus.APPROVED,
        })
        .leftJoinAndSelect('withdrawal.withdrawalPoints', 'withdrawalPoints')
        .orderBy('withdrawal.reviewedAt', 'DESC');

      if (filters?.startDate) {
        queryBuilder.andWhere('withdrawal.reviewedAt >= :startDate', {
          startDate: new Date(filters.startDate),
        });
      }

      if (filters?.endDate) {
        const endOfDay = new Date(filters.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        queryBuilder.andWhere('withdrawal.reviewedAt <= :endDate', {
          endDate: endOfDay,
        });
      }

      if (filters?.userId) {
        queryBuilder.andWhere('withdrawal.userId = :userId', {
          userId: filters.userId,
        });
      }

      return await queryBuilder.getMany();
    } catch (error) {
      this.logger.error(`Error fetching reports: ${error.message}`);
      throw new RpcException({
        status: 500,
        message: 'Error interno al obtener reportes',
      });
    }
  }

  async signWithdrawalReport(
    withdrawalId: number,
    userDocumentNumber: string,
    userRazonSocial: string,
    signatureFile: Express.Multer.File,
  ): Promise<{ url: string; withdrawalId: number }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const withdrawal = await this.withdrawalRepository.findOne({
        where: { id: withdrawalId },
      });
      if (!withdrawal)
        throw new RpcException({
          status: 404,
          message: `Retiro con ID ${withdrawalId} no encontrado`,
        });

      if (withdrawal.status !== WithdrawalStatus.PENDING_SIGNATURE)
        throw new RpcException({
          status: 400,
          message: `El retiro no está en estado PENDING_SIGNATURE. Estado actual: ${withdrawal.status}`,
        });

      // 1. Convertir imagen a base64 para usar directamente en el PDF
      const imageBase64 = `data:${signatureFile.mimetype};base64,${signatureFile.buffer.toString('base64')}`;
      // 2. Generar el reporte con la imagen de firma
      const pdfResult = await this.reportsWithdrawalService.generateLiquidation(
        withdrawalId,
        userDocumentNumber,
        userRazonSocial,
        imageBase64,
      );
      withdrawal.signedPdfUrl = pdfResult.url;
      withdrawal.status = WithdrawalStatus.PENDING;
      await queryRunner.manager.save(withdrawal);
      await queryRunner.commitTransaction();

      this.logger.log(
        `Reporte firmado generado exitosamente para retiro: ${withdrawalId}`,
      );

      return {
        url: pdfResult.url,
        withdrawalId: withdrawal.id,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error al firmar reporte de retiro: ${error.message}`);
      if (error instanceof RpcException) throw error;
      throw new RpcException({
        status: 500,
        message: 'Error interno al firmar reporte de retiro',
      });
    } finally {
      await queryRunner.release();
    }
  }

  async checkPendingWithdrawals(userId: string): Promise<{
    hasPendingWithdrawals: boolean;
    pendingCount: number;
    pendingWithdrawals?: any[];
  }> {
    try {
      this.logger.log(`🔍 Verificando retiros pendientes para usuario: ${userId}`);

      const pendingWithdrawals = await this.withdrawalRepository.find({
        where: {
          userId,
          status: WithdrawalStatus.PENDING,
        },
        select: ['id', 'amount', 'status', 'createdAt'],
        order: { createdAt: 'DESC' },
      });

      const pendingSignatureWithdrawals = await this.withdrawalRepository.find({
        where: {
          userId,
          status: WithdrawalStatus.PENDING_SIGNATURE,
        },
        select: ['id', 'amount', 'status', 'createdAt'],
        order: { createdAt: 'DESC' },
      });

      const allPending = [...pendingWithdrawals, ...pendingSignatureWithdrawals];
      const hasPendingWithdrawals = allPending.length > 0;

      this.logger.log(
        `✅ Usuario ${userId} tiene ${allPending.length} retiros pendientes`,
      );

      return {
        hasPendingWithdrawals,
        pendingCount: allPending.length,
        pendingWithdrawals: allPending,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error verificando retiros pendientes para usuario ${userId}:`,
        error,
      );
      throw new RpcException({
        status: 500,
        message: 'Error interno al verificar retiros pendientes',
      });
    }
  }
}
