import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  RpcException,
  Transport,
} from '@nestjs/microservices';
import { catchError, firstValueFrom } from 'rxjs';
import { envs } from 'src/config/envs';
import { ReserveForWithdrawal } from '../interfaces/reserve-for-withdrawal.interface';

@Injectable()
export class PointsService {
  private readonly pointsClient: ClientProxy;
  constructor() {
    this.pointsClient = ClientProxyFactory.create({
      transport: Transport.NATS,
      options: {
        servers: [envs.NATS_SERVERS],
      },
    });
  }

  async reserveForWithdrawal(
    userId: string,
    userName: string,
    userEmail: string,
    amount: number,
  ): Promise<ReserveForWithdrawal> {
    return await firstValueFrom(
      this.pointsClient
        .send(
          { cmd: 'pointsTransaction.reserveForWithdrawal' },
          { userId, userName, userEmail, amount },
        )
        .pipe(
          catchError((error) => {
            if (error instanceof RpcException) throw error;
            const err = error as {
              message?: string | string[];
              status?: number;
              service?: string;
            };
            // Determinamos el mensaje del error
            let errorMessage: string[];
            if (Array.isArray(err?.message)) {
              errorMessage = err.message;
            } else if (typeof err?.message === 'string') {
              errorMessage = [err.message];
            } else {
              errorMessage = ['Unknown RPC Error'];
            }
            const statusCode =
              typeof err?.status === 'number'
                ? err.status
                : HttpStatus.INTERNAL_SERVER_ERROR;
            const service = err?.service || 'ms-nexus-gateway';
            throw new RpcException({
              status: statusCode,
              message: errorMessage,
              service,
            });
          }),
        ),
    );
  }

  async approveWithdrawal(
    withdrawalId: number,
    userId: string,
    reviewerId: string,
    reviewerEmail: string,
    withdrawalPoints: Array<{
      pointsTransactionId: string;
      amountUsed: number;
    }>,
  ): Promise<{ message: string }> {
    return await firstValueFrom(
      this.pointsClient
        .send(
          { cmd: 'points.approveWithdrawal' },
          {
            withdrawalId,
            userId,
            reviewerId,
            reviewerEmail,
            withdrawalPoints,
          },
        )
        .pipe(
          catchError((error) => {
            if (error instanceof RpcException) throw error;
            const err = error as {
              message?: string | string[];
              status?: number;
              service?: string;
            };
            // Determinamos el mensaje del error
            let errorMessage: string[];
            if (Array.isArray(err?.message)) {
              errorMessage = err.message;
            } else if (typeof err?.message === 'string') {
              errorMessage = [err.message];
            } else {
              errorMessage = ['Unknown RPC Error'];
            }
            const statusCode =
              typeof err?.status === 'number'
                ? err.status
                : HttpStatus.INTERNAL_SERVER_ERROR;
            const service = err?.service || 'ms-nexus-gateway';
            throw new RpcException({
              status: statusCode,
              message: errorMessage,
              service,
            });
          }),
        ),
    );
  }

  async rejectWithdrawal(
    withdrawalId: number,
    userId: string,
    amount: number,
    reviewerId: string,
    reviewerEmail: string,
    rejectionReason: string,
    withdrawalPoints: Array<{
      pointsTransactionId: string;
      amountUsed: number;
    }>,
  ): Promise<{ message: string }> {
    return await firstValueFrom(
      this.pointsClient
        .send(
          { cmd: 'points.rejectWithdrawal' },
          {
            withdrawalId,
            userId,
            amount,
            reviewerId,
            reviewerEmail,
            rejectionReason,
            withdrawalPoints,
          },
        )
        .pipe(
          catchError((error) => {
            if (error instanceof RpcException) throw error;
            const err = error as {
              message?: string | string[];
              status?: number;
              service?: string;
            };
            // Determinamos el mensaje del error
            let errorMessage: string[];
            if (Array.isArray(err?.message)) {
              errorMessage = err.message;
            } else if (typeof err?.message === 'string') {
              errorMessage = [err.message];
            } else {
              errorMessage = ['Unknown RPC Error'];
            }
            const statusCode =
              typeof err?.status === 'number'
                ? err.status
                : HttpStatus.INTERNAL_SERVER_ERROR;
            const service = err?.service || 'ms-nexus-gateway';
            throw new RpcException({
              status: statusCode,
              message: errorMessage,
              service,
            });
          }),
        ),
    );
  }

  async getPointsTransactionById(
    pointsTransactionId: string,
  ): Promise<{ paymentId: string }[]> {
    return await firstValueFrom(
      this.pointsClient
        .send(
          { cmd: 'pointsTransactionPayments.findByTransactionId' },
          { transactionId: pointsTransactionId },
        )
        .pipe(
          catchError((error) => {
            if (error instanceof RpcException) throw error;
            const err = error as {
              message?: string | string[];
              status?: number;
              service?: string;
            };
            // Determinamos el mensaje del error
            let errorMessage: string[];
            if (Array.isArray(err?.message)) {
              errorMessage = err.message;
            } else if (typeof err?.message === 'string') {
              errorMessage = [err.message];
            } else {
              errorMessage = ['Unknown RPC Error'];
            }
            const statusCode =
              typeof err?.status === 'number'
                ? err.status
                : HttpStatus.INTERNAL_SERVER_ERROR;
            const service = err?.service || 'ms-nexus-gateway';
            throw new RpcException({
              status: statusCode,
              message: errorMessage,
              service,
            });
          }),
        ),
    );
  }

  async getUserPoints(userId: string): Promise<{
    availablePoints: number;
    totalEarnedPoints: number;
    totalWithdrawnPoints: number;
  }> {
    return await firstValueFrom(
      this.pointsClient.send({ cmd: 'userPoints.get' }, { userId }).pipe(
        catchError((error) => {
          if (error instanceof RpcException) throw error;
          const err = error as {
            message?: string | string[];
            status?: number;
            service?: string;
          };
          let errorMessage: string[];
          if (Array.isArray(err?.message)) {
            errorMessage = err.message;
          } else if (typeof err?.message === 'string') {
            errorMessage = [err.message];
          } else {
            errorMessage = ['Unknown RPC Error'];
          }
          const statusCode =
            typeof err?.status === 'number'
              ? err.status
              : HttpStatus.INTERNAL_SERVER_ERROR;
          const service = err?.service || 'ms-nexus-gateway';
          throw new RpcException({
            status: statusCode,
            message: errorMessage,
            service,
          });
        }),
      ),
    );
  }

  async deductPointsForPayment(
    userId: string,
    userName: string,
    userEmail: string,
    amount: number,
    paymentId: number,
    paymentReference: string,
  ): Promise<{ transactionId: number }> {
    return await firstValueFrom(
      this.pointsClient
        .send(
          { cmd: 'pointsTransaction.deductForPayment' },
          {
            userId,
            userName,
            userEmail,
            amount,
            paymentId,
            paymentReference,
          },
        )
        .pipe(
          catchError((error) => {
            if (error instanceof RpcException) throw error;
            const err = error as {
              message?: string | string[];
              status?: number;
              service?: string;
            };
            let errorMessage: string[];
            if (Array.isArray(err?.message)) {
              errorMessage = err.message;
            } else if (typeof err?.message === 'string') {
              errorMessage = [err.message];
            } else {
              errorMessage = ['Unknown RPC Error'];
            }
            const statusCode =
              typeof err?.status === 'number'
                ? err.status
                : HttpStatus.INTERNAL_SERVER_ERROR;
            const service = err?.service || 'ms-nexus-gateway';
            throw new RpcException({
              status: statusCode,
              message: errorMessage,
              service,
            });
          }),
        ),
    );
  }

  async getUserVolumeHistory(
    userId: string,
    page: number = 1,
    limit: number = 10,
    startDate?: string,
    endDate?: string,
    status?: 'PENDING' | 'PROCESSED' | 'CANCELLED',
  ): Promise<{
    items: Array<{
      id: number;
      leftVolume: number;
      rightVolume: number;
      commissionEarned?: number;
      weekStartDate: Date;
      weekEndDate: Date;
      status: string;
      selectedSide?: 'LEFT' | 'RIGHT';
      processedAt?: Date;
      metadata?: Record<string, any>;
      createdAt: Date;
      updatedAt: Date;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    return await firstValueFrom(
      this.pointsClient
        .send(
          { cmd: 'weeklyVolume.getUserWeeklyVolumes' },
          {
            userId,
            page,
            limit,
            startDate,
            endDate,
            status,
          },
        )
        .pipe(
          catchError((error) => {
            if (error instanceof RpcException) throw error;
            const err = error as {
              message?: string | string[];
              status?: number;
              service?: string;
            };
            let errorMessage: string[];
            if (Array.isArray(err?.message)) {
              errorMessage = err.message;
            } else if (typeof err?.message === 'string') {
              errorMessage = [err.message];
            } else {
              errorMessage = ['Unknown RPC Error'];
            }
            const statusCode =
              typeof err?.status === 'number'
                ? err.status
                : HttpStatus.INTERNAL_SERVER_ERROR;
            const service = err?.service || 'ms-nexus-gateway';
            throw new RpcException({
              status: statusCode,
              message: errorMessage,
              service,
            });
          }),
        ),
    );
  }

  async getUserPointsTransactions(
    userId: string,
    page: number = 1,
    limit: number = 10,
    type?: string,
    status?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<{
    items: Array<{
      id: number;
      userId: string;
      userEmail: string;
      userName?: string;
      type: string;
      amount: number;
      pendingAmount: number;
      withdrawnAmount: number;
      status: string;
      isArchived: boolean;
      metadata: Record<string, any>;
      createdAt: Date;
      updatedAt: Date;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    return await firstValueFrom(
      this.pointsClient
        .send(
          { cmd: 'pointsTransaction.get' },
          {
            userId,
            page,
            limit,
            type,
            status,
            startDate,
            endDate,
          },
        )
        .pipe(
          catchError((error) => {
            if (error instanceof RpcException) throw error;
            const err = error as {
              message?: string | string[];
              status?: number;
              service?: string;
            };
            let errorMessage: string[];
            if (Array.isArray(err?.message)) {
              errorMessage = err.message;
            } else if (typeof err?.message === 'string') {
              errorMessage = [err.message];
            } else {
              errorMessage = ['Unknown RPC Error'];
            }
            const statusCode =
              typeof err?.status === 'number'
                ? err.status
                : HttpStatus.INTERNAL_SERVER_ERROR;
            const service = err?.service || 'ms-nexus-gateway';
            throw new RpcException({
              status: statusCode,
              message: errorMessage,
              service,
            });
          }),
        ),
    );
  }
}
