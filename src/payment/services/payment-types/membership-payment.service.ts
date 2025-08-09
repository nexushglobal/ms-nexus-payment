import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  RpcException,
  Transport,
} from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { envs } from 'src/config/envs';
import { Payment } from '../../entities/payment.entity';

@Injectable()
export class MembershipPaymentService {
  private readonly logger = new Logger(MembershipPaymentService.name);
  private readonly membershipClient: ClientProxy;
  private readonly userClient: ClientProxy;
  private readonly pointClient: ClientProxy;

  constructor() {
    this.membershipClient = ClientProxyFactory.create({
      transport: Transport.NATS,
      options: {
        servers: [envs.NATS_SERVERS],
      },
    });
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

  async processMembershipPayment(payment: Payment): Promise<void> {
    try {
      this.logger.log(
        `Procesando pago de membresía para relatedEntityId: ${payment.relatedEntityId}`,
      );

      // Enviar al microservicio de membresía para actualizar a aprobado
      const membershipResponse: {
        planName: string;
        binaryPoints: number;
      } = await firstValueFrom(
        this.membershipClient.send(
          { cmd: 'membership.approveMembership' },
          {
            membershipId: parseInt(payment.relatedEntityId),
            paymentId: payment.id,
            amount: payment.amount,
            approvedAt: new Date(),
          },
        ),
      );

      this.logger.log(
        `Pago de membresía procesado exitosamente para ID: ${payment.relatedEntityId}`,
      );

      // Procesar puntos por referido directo
      await this.processDirectReferralBonus(
        payment,
        membershipResponse.planName,
      );

      // Procesar puntos de volumen por referido directo
      await this.processBinaryVolumePoints(
        payment,
        membershipResponse.binaryPoints,
      );
    } catch (error) {
      this.logger.error(
        `Error al procesar pago de membresía: ${error.message}`,
      );
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al procesar pago de membresía',
      });
    }
  }

  private async processDirectReferralBonus(
    payment: Payment,
    planName: string,
  ): Promise<void> {
    try {
      this.logger.log(
        `Procesando bonificación por referido directo para usuario: ${payment.userId}`,
      );

      // Obtener la membresía del referido padre
      const referrerResponse = await firstValueFrom(
        this.userClient.send(
          { cmd: 'user.getReferrerMembership' },
          { userId: payment.userId },
        ),
      );

      let directBonus = 0;
      let metadata: Record<string, any> = {
        usuarioHijo: payment.userId,
        montoDelPago: payment.amount,
        codigoOperacion: payment.operationCode || 'N/A',
        plan: planName,
      };

      // Verificar si tiene referido padre y membresía activa
      if (
        referrerResponse.hasReferrer &&
        referrerResponse.referrerMembership?.hasActiveMembership
      ) {
        const { referrerMembership } = referrerResponse;

        // Calcular bonificación directa
        directBonus =
          (payment.amount * referrerMembership.plan.directCommissionAmount) /
          100;

        metadata = {
          ...metadata,
          planDelPadre: referrerMembership.plan.name,
          porcentajeComision: referrerMembership.plan.directCommissionAmount,
          razon: 'Bonificación por referido directo - Membresía aprobada',
        };

        // Preparar payload para el microservicio de puntos
        const pointsPayload = {
          users: [
            {
              userId: referrerMembership.userId,
              userName: referrerMembership.userName,
              userEmail: referrerMembership.userEmail,
              paymentReference: payment.operationCode || `PAY-${payment.id}`,
              directBonus: directBonus,
              type: 'DIRECT_BONUS',
              metadata: metadata,
            },
          ],
        };

        // Enviar puntos al microservicio de puntos
        await firstValueFrom(
          this.pointClient.send(
            { cmd: 'points.addDirectBonus' },
            pointsPayload,
          ),
        );

        this.logger.log(
          `Bonificación directa enviada exitosamente. Usuario padre: ${referrerMembership.userId}, Puntos: ${directBonus}`,
        );
      } else {
        // El padre no tiene membresía activa o no tiene referido padre
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

        metadata.razon = razon;
        metadata.bonificacion = 0;

        // Aún enviamos el payload pero con bonificación 0 si tenemos la información del padre
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
              { cmd: 'points.addDirectBonus' },
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
      // No lanzamos excepción para no afectar el flujo principal del pago
    }
  }

  private async processBinaryVolumePoints(
    payment: Payment,
    binaryPoints: number,
  ): Promise<void> {
    try {
      this.logger.log(
        `Procesando puntos de volumen binario para usuario: ${payment.userId}`,
      );

      // Obtener todos los usuarios superiores en el árbol binario con membresía activa
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
        // Preparar los usuarios para el volumen semanal
        const usersForVolume = ancestorsResponse.map((ancestor) => ({
          userId: ancestor.userId,
          userName: ancestor.userName,
          userEmail: ancestor.userEmail,
          site: ancestor.site,
          paymentId: payment.id.toString(),
        }));

        // Crear el payload para el microservicio de puntos
        const volumePayload = {
          amount: payment.amount,
          volume: binaryPoints,
          users: usersForVolume,
        };

        // Enviar al microservicio de puntos para crear el volumen semanal
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
      // No lanzamos excepción para no afectar el flujo principal del pago
    }
  }

  async processMembershipPaymentRejection(payment: Payment): Promise<void> {
    try {
      this.logger.log(
        `Procesando rechazo de pago de membresía para relatedEntityId: ${payment.relatedEntityId}`,
      );

      const data = {
        membershipId: parseInt(payment.relatedEntityId),
        paymentId: payment.id,
        reason: payment.rejectionReason,
      };
      console.log('Data to send:', data);
      await firstValueFrom(
        this.membershipClient.send(
          { cmd: 'membership.rejectMembership' },
          data,
        ),
      );

      this.logger.log(
        `Rechazo de pago de membresía procesado exitosamente para ID: ${payment.relatedEntityId}`,
      );
    } catch (error) {
      console.error('Error al procesar rechazo de pago de membresía:', error);
      this.logger.error(
        `Error al procesar rechazo de pago de membresía: ${error.message}`,
      );
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al procesar rechazo de pago de membresía',
      });
    }
  }

  async onModuleDestroy() {
    await this.membershipClient.close();
  }
}
