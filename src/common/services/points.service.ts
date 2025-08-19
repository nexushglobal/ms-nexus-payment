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
}
