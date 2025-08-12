/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { paginate } from 'src/common/helpers/paginate.helper';
import { DataSource, Repository } from 'typeorm';
import { PointsService } from '../common/services/points.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { FindWithdrawalsDto } from './dto/find-withdrawals.dto';
import { WithdrawalPoints } from './entities/wirhdrawal-points.entity';
import { Withdrawal, WithdrawalStatus } from './entities/withdrawal.entity';
import { formatCreateWithdrawalResponse } from './helpers/format-create-withdrawal-response.helper';
import { formatListWithdrawalsResponse } from './helpers/format-list-withdrawal-response.helper';
import { formatOneWithdrawalResponse } from './helpers/format-one-withdrawal-response.helper';

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
      } = createWithdrawalDto;

      this.logger.log(
        `Iniciando creación de retiro para usuario ${userId}, monto: ${amount}`,
      );
      const reserveForWithdrawal =
        await this.pointsService.reserveForWithdrawal(userId, amount);

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
        status: WithdrawalStatus.PENDING,
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

      this.logger.log(`Retiro creado exitosamente: ${savedWithdrawal.id}`);

      return formatCreateWithdrawalResponse(savedWithdrawal);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error al crear retiro: ${error.message}`);
      if (error instanceof RpcException) throw error;
      throw new RpcException({
        status: 500,
        message: 'Error interno al crear retiro',
      });
    } finally {
      await queryRunner.release();
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

  async findOneWithdrawal(id: number): Promise<any> {
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
}
