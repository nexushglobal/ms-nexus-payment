import { Injectable, Logger } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { envs } from 'src/config/envs';
import { Payment } from '../../entities/payment.entity';

export interface BonusMetadata {
  Referido: string;
  'Monto del Pago': number;
  // codigoOperacion: string;
  [key: string]: any;
}

@Injectable()
export class BonusProcessingService {
  private readonly logger = new Logger(BonusProcessingService.name);
  private readonly userClient: ClientProxy;
  private readonly pointClient: ClientProxy;

  constructor() {
    this.userClient = ClientProxyFactory.create({
      transport: Transport.NATS,
      options: {
        servers: [envs.NATS_SERVERS],
      },
    });
    this.pointClient = ClientProxyFactory.create({
      transport: Transport.NATS,
      options: {
        servers: [envs.NATS_SERVERS],
      },
    });
  }

  async processDirectReferralBonus(
    payment: Payment,
    customMetadata: Record<string, any> = {},
    isUpgrade: boolean = false,
  ): Promise<void> {
    try {
      this.logger.log(
        `Procesando bonificación por referido directo para usuario: ${payment.userId}`,
      );

      const referrerResponse = await firstValueFrom(
        this.userClient.send(
          { cmd: 'user.getReferrerMembership' },
          { userId: payment.userId },
        ),
      );

      let directBonus = 0;
      let metadata: BonusMetadata = {
        ...customMetadata,
        Referido: payment.userName,
        'Monto del Pago': payment.amount,
        // codigoOperacion: payment.operationCode || 'N/A',
      };

      if (
        referrerResponse.hasReferrer &&
        referrerResponse.referrerMembership?.hasActiveMembership
      ) {
        const { referrerMembership } = referrerResponse;

        directBonus =
          (payment.amount * referrerMembership.plan.directCommissionAmount) /
          100;

        metadata = {
          ...metadata,
          'Plan del referente': referrerMembership.plan.name,
          'Porcentaje de comisión':
            referrerMembership.plan.directCommissionAmount,
          Razón: isUpgrade
            ? 'Bonificación por referido directo - Membresía actualizada'
            : 'Bonificación por referido directo - Membresía aprobada',
        };

        const pointsPayload = {
          users: [
            {
              userId: referrerMembership.userId,
              userName: referrerMembership.userName,
              userEmail: referrerMembership.userEmail,
              paymentId: payment.id.toString(),
              paymentReference: payment.operationCode || `PAY-${payment.id}`,
              directBonus: directBonus,
              type: 'DIRECT_BONUS',
              metadata: metadata,
            },
          ],
        };

        await firstValueFrom(
          this.pointClient.send(
            { cmd: 'userPoints.createDirectBonus' },
            pointsPayload,
          ),
        );

        this.logger.log(
          `Bonificación directa enviada exitosamente. Usuario padre: ${referrerMembership.userId}, Puntos: ${directBonus}`,
        );
      } else {
        let razon = '';
        if (!referrerResponse.hasReferrer) {
          razon = 'El usuario no tiene un referido padre';
        } else if (!referrerResponse.referrerMembership?.hasActiveMembership) {
          razon = 'El padre no tiene membresía activa';
        } else {
          razon =
            referrerResponse.message ||
            'Error desconocido al consultar membresía del padre';
        }

        metadata.Razón = razon;
        metadata.Bonificacion = 0;

        if (
          referrerResponse.hasReferrer &&
          referrerResponse.referrerMembership
        ) {
          const pointsPayload = {
            users: [
              {
                userId: referrerResponse.referrerMembership.userId || 'N/A',
                userName:
                  referrerResponse.referrerMembership.userName ||
                  'Usuario no encontrado',
                userEmail:
                  referrerResponse.referrerMembership.userEmail ||
                  'email@no-encontrado.com',
                paymentReference: payment.operationCode || `PAY-${payment.id}`,
                directBonus: 0,
                type: 'DIRECT_BONUS',
                metadata: metadata,
              },
            ],
          };

          await firstValueFrom(
            this.pointClient.send(
              { cmd: 'userPoints.createDirectBonus' },
              pointsPayload,
            ),
          );
        }

        this.logger.log(`No se otorgó bonificación directa: ${razon}`);
      }
    } catch (error) {
      this.logger.error(
        `Error al procesar bonificación por referido directo: ${error.message}`,
      );
    }
  }

  async processBinaryVolumePoints(
    payment: Payment,
    binaryPoints: number,
  ): Promise<void> {
    try {
      this.logger.log(
        `Procesando puntos de volumen binario para usuario: ${payment.userId}`,
      );

      const ancestorsResponse: {
        userId: string;
        userName: string;
        userEmail: string;
        site: 'LEFT' | 'RIGHT';
      }[] = await firstValueFrom(
        this.userClient.send(
          { cmd: 'user.getActiveAncestorsWithMembership' },
          { userId: payment.userId },
        ),
      );

      if (ancestorsResponse && ancestorsResponse.length > 0) {
        const usersForVolume = ancestorsResponse.map((ancestor) => ({
          userId: ancestor.userId,
          userName: ancestor.userName,
          userEmail: ancestor.userEmail,
          site: ancestor.site,
          paymentId: payment.id.toString(),
        }));

        const volumePayload = {
          amount: payment.amount,
          volume: binaryPoints,
          users: usersForVolume,
        };

        await firstValueFrom(
          this.pointClient.send(
            { cmd: 'weeklyVolume.createVolume' },
            volumePayload,
          ),
        );

        this.logger.log(
          `Puntos de volumen binario procesados exitosamente. Ancestros encontrados: ${ancestorsResponse.length}, Volumen: ${binaryPoints}`,
        );
      } else {
        this.logger.log(
          `No se encontraron ancestros con membresía activa para el usuario: ${payment.userId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error al procesar puntos de volumen binario: ${error.message}`,
      );
    }
  }

  async processMonthlyVolumePoints(
    payment: Payment,
    volume: number,
  ): Promise<void> {
    try {
      this.logger.log(
        `Procesando puntos de volumen mensual para usuario: ${payment.userId}`,
      );

      const ancestorsResponse: {
        userId: string;
        userName: string;
        userEmail: string;
        site: 'LEFT' | 'RIGHT';
      }[] = await firstValueFrom(
        this.userClient.send(
          { cmd: 'user.getActiveAncestorsWithMembership' },
          { userId: payment.userId },
        ),
      );

      if (ancestorsResponse && ancestorsResponse.length > 0) {
        const usersForVolume = ancestorsResponse.map((ancestor) => ({
          userId: ancestor.userId,
          userName: ancestor.userName,
          userEmail: ancestor.userEmail,
          site: ancestor.site,
          paymentId: payment.id.toString(),
        }));

        const volumePayload = {
          amount: payment.amount,
          volume: volume,
          users: usersForVolume,
        };

        await firstValueFrom(
          this.pointClient.send(
            { cmd: 'monthlyVolume.createMonthlyVolume' },
            volumePayload,
          ),
        );

        this.logger.log(
          `Puntos de volumen mensual procesados exitosamente. Ancestros encontrados: ${ancestorsResponse.length}, Volumen: ${volume}`,
        );
      } else {
        this.logger.log(
          `No se encontraron ancestros con membresía activa para el usuario: ${payment.userId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error al procesar puntos de volumen mensual: ${error.message}`,
      );
    }
  }

  async onModuleDestroy() {
    await this.userClient.close();
    await this.pointClient.close();
  }
}
