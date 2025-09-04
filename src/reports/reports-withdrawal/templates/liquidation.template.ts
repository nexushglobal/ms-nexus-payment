import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { formatDate } from 'src/reports/helpers/format-date.helper';
import { FindOneWithdrawalWithReportResponseDto } from 'src/withdrawals/dto/find-one-withdrawal-with-report.dto';

interface WeeklyVolumeResponseDto {
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
}

interface WeeklyVolumeHistoryResponse {
  items: WeeklyVolumeResponseDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface PointsTransactionResponseDto {
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
}

interface PointsTransactionHistoryResponse {
  items: PointsTransactionResponseDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface LiquidationOptions {
  title?: string;
  liquidationNumber: string;
  withdrawal: FindOneWithdrawalWithReportResponseDto;
  userDocumentNumber: string;
  userRazonSocial: string;
  companyName?: string;
  managerName?: string;
  accountantName?: string;
  commissionistSignatureImage?: string;
  volumeHistory?: WeeklyVolumeHistoryResponse;
  pointsHistory?: PointsTransactionHistoryResponse;
}

export const getLiquidationReport = (
  options: LiquidationOptions,
): TDocumentDefinitions => {
  const {
    liquidationNumber,
    withdrawal,
    userDocumentNumber,
    userRazonSocial,
    managerName = 'CESAR HUERTAS ANAYA',
    accountantName = 'CONTABILIDAD',
    commissionistSignatureImage,
    volumeHistory,
    pointsHistory,
  } = options;

  const fechaActual = new Date().toLocaleDateString('es-PE');

  const tableRows: any[] = [];
  let totalAmount = 0;

  withdrawal.withdrawalPoints?.forEach((point) => {
    const metadata = point.metadata || {};
    const tipoTransaccion = metadata.tipo_transaccion || 'RETIRO DE PUNTOS';

    totalAmount += point.amountUsed;

    const fecha =
      tipoTransaccion === 'DIRECT_BONUS' && metadata.fecha_creacion
        ? formatDate(metadata.fecha_creacion as Date)
        : '';

    const concepto =
      tipoTransaccion === 'DIRECT_BONUS'
        ? 'COMISION'
        : tipoTransaccion === 'BINARY_COMMISSION'
          ? 'BONO BINARIO'
          : tipoTransaccion;

    // Procesar múltiples boletas y códigos de operación
    let boletas = '';
    let operaciones = '';
    let importeTotal = 0;

    if (point.paymentsInfo && point.paymentsInfo.length > 0) {
      const ticketNumbers: string[] = [];
      const operationCodes: string[] = [];

      point.paymentsInfo.forEach((payment) => {
        if (payment.ticketNumber) {
          ticketNumbers.push(payment.ticketNumber);
        }
        if (payment.operationCode) {
          operationCodes.push(payment.operationCode);
        }
        importeTotal += payment.amount || 0;
      });

      boletas = ticketNumbers.join(', ');
      operaciones = operationCodes.join(', ');
    }

    tableRows.push([
      {
        text: (tableRows.length + 1).toString(),
        fontSize: 8,
        alignment: 'center',
      },
      { text: concepto, fontSize: 8, alignment: 'center' },
      {
        text: boletas,
        fontSize: 8,
        alignment: 'center',
        // Para que el texto largo se ajuste en múltiples líneas
        lineHeight: 1.2,
      },
      { text: fecha, fontSize: 8, alignment: 'center' },
      {
        text: importeTotal.toFixed(2),
        fontSize: 8,
        alignment: 'center',
      },
      { text: 'Interbank', fontSize: 8, alignment: 'center' },
      {
        text: operaciones,
        fontSize: 8,
        alignment: 'center',
        lineHeight: 1.2,
      },
      {
        text: point.amountUsed.toFixed(2),
        fontSize: 8,
        alignment: 'center',
      },
    ]);
  });

  // Preparar datos de historial de volúmenes
  const volumeRows: any[] = [];

  if (
    volumeHistory &&
    volumeHistory.items &&
    Array.isArray(volumeHistory.items) &&
    volumeHistory.items.length > 0
  ) {
    // Los datos ya vienen ordenados desde el servicio, solo procesamos directamente
    volumeHistory.items.forEach((weeklyVolume, index) => {
      const startDate = new Date(weeklyVolume.weekStartDate).toLocaleDateString(
        'es-PE',
      );
      const endDate = new Date(weeklyVolume.weekEndDate).toLocaleDateString(
        'es-PE',
      );
      const semana = `${startDate} - ${endDate}`;

      volumeRows.push([
        {
          text: (index + 1).toString(),
          fontSize: 8,
          alignment: 'center',
        },
        {
          text: semana,
          fontSize: 8,
          alignment: 'center',
        },
        {
          text: weeklyVolume.leftVolume.toFixed(2),
          fontSize: 8,
          alignment: 'center',
        },
        {
          text: weeklyVolume.rightVolume.toFixed(2),
          fontSize: 8,
          alignment: 'center',
        },
        {
          text: weeklyVolume.commissionEarned
            ? weeklyVolume.commissionEarned.toFixed(2)
            : '0.00',
          fontSize: 8,
          alignment: 'center',
        },
        {
          text:
            weeklyVolume.status === 'PROCESSED'
              ? 'PROCESADO'
              : weeklyVolume.status === 'PENDING'
                ? 'PENDIENTE'
                : 'CANCELADO',
          fontSize: 8,
          alignment: 'center',
        },
      ]);
    });
  }

  // Preparar datos de historial de puntos
  const pointsRows: any[] = [];

  if (
    pointsHistory &&
    pointsHistory.items &&
    Array.isArray(pointsHistory.items) &&
    pointsHistory.items.length > 0
  ) {
    pointsHistory.items.forEach((pointsTransaction, index) => {
      const fecha = new Date(pointsTransaction.createdAt).toLocaleDateString(
        'es-PE',
      );

      const tipo =
        pointsTransaction.type === 'DIRECT_BONUS'
          ? 'COMISION'
          : pointsTransaction.type === 'BINARY_COMMISSION'
            ? 'BONO BINARIO'
            : pointsTransaction.type === 'WITHDRAWAL'
              ? 'RETIRO'
              : pointsTransaction.type === 'RECONSUMPTION'
                ? 'RECONSUMO'
                : pointsTransaction.type;

      const estado =
        pointsTransaction.status === 'COMPLETED'
          ? 'COMPLETADO'
          : pointsTransaction.status === 'PENDING'
            ? 'PENDIENTE'
            : pointsTransaction.status === 'CANCELLED'
              ? 'CANCELADO'
              : pointsTransaction.status;

      pointsRows.push([
        {
          text: (index + 1).toString(),
          fontSize: 8,
          alignment: 'center',
        },
        {
          text: fecha,
          fontSize: 8,
          alignment: 'center',
        },
        {
          text: tipo,
          fontSize: 8,
          alignment: 'center',
        },
        {
          text: pointsTransaction.amount.toFixed(2),
          fontSize: 8,
          alignment: 'center',
        },
        {
          text: estado,
          fontSize: 8,
          alignment: 'center',
        },
      ]);
    });
  }

  // Calcular IGV y valor
  const igvRate = 0.18;
  const total = totalAmount;
  const valor = total / (1 + igvRate);
  const igv = total - valor;

  return {
    pageOrientation: 'portrait',
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 60] as [number, number, number, number],

    content: [
      // NEXUS logo a la derecha (sin fecha)
      {
        columns: [
          { text: '', width: '*' },
          {
            text: 'NEXUS',
            fontSize: 24,
            bold: true,
            color: 'white',
            background: '#2c5530',
            alignment: 'center',
            margin: [15, 8, 15, 8] as [number, number, number, number],
            width: 'auto',
          },
        ],
        margin: [0, 0, 0, 10] as [number, number, number, number],
      },

      // Título centrado y más pequeño
      {
        text: `LIQUIDACION N° ${liquidationNumber}`,
        fontSize: 12,
        bold: true,
        alignment: 'center',
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },

      // RUC y fecha de liquidación en la misma línea
      {
        columns: [
          {
            text: [
              { text: 'RUC ', fontSize: 9, bold: true },
              { text: userDocumentNumber ?? '', fontSize: 9 },
            ],
            width: '*',
          },
          {
            text: [
              { text: 'FECHA DE LIQ. ', fontSize: 9, bold: true },
              { text: fechaActual, fontSize: 9 },
            ],
            alignment: 'right',
            width: 'auto',
          },
        ],
        margin: [0, 0, 0, 5] as [number, number, number, number],
      },

      // Razón social
      {
        text: [
          { text: 'RAZÓN SOCIAL ', fontSize: 9, bold: true },
          {
            text: userRazonSocial ?? '',
            fontSize: 9,
          },
        ],
        margin: [0, 0, 0, 15] as [number, number, number, number],
      },

      // Tabla principal con ancho completo
      {
        table: {
          widths: [
            '6%', // ITEM
            '15%', // CONCEPTO (reducido un poco)
            '15%', // N°BOLETA (aumentado para múltiples boletas)
            '11%', // FECHA
            '13%', // IMPORTE
            '12%', // BANCO (reducido un poco)
            '13%', // N° OP (aumentado para múltiples operaciones)
            '15%', // COMISION
          ],
          headerRows: 1,
          body: [
            [
              { text: 'ITEM', fontSize: 8, bold: true, alignment: 'center' },
              {
                text: 'CONCEPTO',
                fontSize: 8,
                bold: true,
                alignment: 'center',
              },
              {
                text: 'N°BOLETA',
                fontSize: 8,
                bold: true,
                alignment: 'center',
              },
              { text: 'FECHA', fontSize: 8, bold: true, alignment: 'center' },
              { text: 'IMPORTE', fontSize: 8, bold: true, alignment: 'center' },
              { text: 'BANCO', fontSize: 8, bold: true, alignment: 'center' },
              { text: 'N° OP', fontSize: 8, bold: true, alignment: 'center' },
              {
                text: 'COMISION',
                fontSize: 8,
                bold: true,
                alignment: 'center',
              },
            ],
            ...tableRows,
          ],
        },
        layout: {
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          // Permitir que el texto se divida en múltiples líneas
          paddingTop: () => 2,
          paddingBottom: () => 2,
        },
        margin: [0, 0, 0, 15] as [number, number, number, number],
      },

      // Totales (ya no hay sección de BONO BINARIO después de la tabla)
      {
        columns: [
          { text: '', width: '58%' },
          {
            stack: [
              {
                columns: [
                  { text: 'VALOR', fontSize: 8, bold: true, width: '30%' },
                  {
                    text: valor.toFixed(2),
                    fontSize: 8,
                    alignment: 'right',
                    width: '70%',
                  },
                ],
              },
              {
                columns: [
                  { text: 'IGV', fontSize: 8, bold: true, width: '30%' },
                  {
                    text: igv.toFixed(2),
                    fontSize: 8,
                    alignment: 'right',
                    width: '70%',
                  },
                ],
              },
              {
                columns: [
                  { text: 'TOTAL', fontSize: 8, bold: true, width: '30%' },
                  {
                    text: total.toFixed(2),
                    fontSize: 8,
                    bold: true,
                    alignment: 'right',
                    width: '70%',
                  },
                ],
              },
            ],
            width: '42%',
          },
        ],
        margin: [0, 0, 0, 30] as [number, number, number, number],
      },

      // Historial de volúmenes (antes de las firmas)
      ...(volumeRows.length > 0
        ? [
            {
              text: 'Historial de volúmenes:',
              fontSize: 10,
              bold: true,
              alignment: 'left' as const,
              margin: [0, 20, 0, 10] as [number, number, number, number],
            },

            // Tabla de historial de volúmenes
            {
              table: {
                widths: [
                  '8%', // ITEM
                  '28%', // SEMANA
                  '16%', // VOL. IZQ
                  '16%', // VOL. DER
                  '16%', // COMISIÓN
                  '16%', // ESTADO
                ],
                headerRows: 1,
                body: [
                  [
                    {
                      text: 'ITEM',
                      fontSize: 8,
                      bold: true,
                      alignment: 'center',
                    },
                    {
                      text: 'SEMANA',
                      fontSize: 8,
                      bold: true,
                      alignment: 'center',
                    },
                    {
                      text: 'VOL. IZQ',
                      fontSize: 8,
                      bold: true,
                      alignment: 'center',
                    },
                    {
                      text: 'VOL. DER',
                      fontSize: 8,
                      bold: true,
                      alignment: 'center',
                    },
                    {
                      text: 'COMISIÓN',
                      fontSize: 8,
                      bold: true,
                      alignment: 'center',
                    },
                    {
                      text: 'ESTADO',
                      fontSize: 8,
                      bold: true,
                      alignment: 'center',
                    },
                  ],
                  ...volumeRows,
                ],
              },
              layout: {
                hLineWidth: () => 1,
                vLineWidth: () => 1,
                paddingTop: () => 2,
                paddingBottom: () => 2,
              },
              margin: [0, 0, 0, 30] as [number, number, number, number],
            },
          ]
        : []),

      // Historial de puntos (después de historial de volúmenes)
      ...(pointsRows.length > 0
        ? [
            {
              text: 'Historial de puntos:',
              fontSize: 10,
              bold: true,
              alignment: 'left' as const,
              margin: [0, 20, 0, 10] as [number, number, number, number],
            },

            // Tabla de historial de puntos
            {
              table: {
                widths: [
                  '10%', // ITEM
                  '22%', // FECHA
                  '30%', // TIPO
                  '19%', // MONTO
                  '19%', // ESTADO
                ],
                headerRows: 1,
                body: [
                  [
                    {
                      text: 'ITEM',
                      fontSize: 8,
                      bold: true,
                      alignment: 'center',
                    },
                    {
                      text: 'FECHA',
                      fontSize: 8,
                      bold: true,
                      alignment: 'center',
                    },
                    {
                      text: 'TIPO',
                      fontSize: 8,
                      bold: true,
                      alignment: 'center',
                    },
                    {
                      text: 'MONTO',
                      fontSize: 8,
                      bold: true,
                      alignment: 'center',
                    },
                    {
                      text: 'ESTADO',
                      fontSize: 8,
                      bold: true,
                      alignment: 'center',
                    },
                  ],
                  ...pointsRows,
                ],
              },
              layout: {
                hLineWidth: () => 1,
                vLineWidth: () => 1,
                paddingTop: () => 2,
                paddingBottom: () => 2,
              },
              margin: [0, 0, 0, 30] as [number, number, number, number],
            },
          ]
        : []),

      // Firmas
      {
        columns: [
          {
            stack: [
              // Espacio reservado EXACTO de 60px - SIEMPRE el mismo
              {
                text: commissionistSignatureImage ? '' : ' ',
                fontSize: 1,
                margin: [0, 60, 0, 0] as [number, number, number, number], // Exactamente 60px de espacio
              },
              // Imagen superpuesta si existe
              ...(commissionistSignatureImage
                ? [
                    {
                      image: commissionistSignatureImage,
                      width: 120,
                      height: 60,
                      alignment: 'center' as const,
                      margin: [0, -60, 0, 0] as [
                        number,
                        number,
                        number,
                        number,
                      ], // Negative margin para posicionar encima
                    },
                  ]
                : []),
              // SIEMPRE mostrar la línea
              {
                text: '___________________________',
                alignment: 'center' as const,
                fontSize: 8,
              },
              {
                text: 'COMISIONISTA',
                alignment: 'center' as const,
                fontSize: 9,
                bold: true,
                margin: [0, 5, 0, 0] as [number, number, number, number],
              },
              {
                text: userRazonSocial ?? '',
                alignment: 'center' as const,
                fontSize: 8,
                margin: [0, 5, 0, 0] as [number, number, number, number],
              },
            ],
            width: '33%',
          },
          {
            stack: [
              // Espacio reservado EXACTO de 60px - igual que comisionista
              {
                text: ' ',
                fontSize: 1,
                margin: [0, 60, 0, 0] as [number, number, number, number], // Exactamente 60px de espacio
              },
              // SIEMPRE mostrar la línea
              {
                text: '___________________________',
                alignment: 'center' as const,
                fontSize: 8,
              },
              {
                text: managerName,
                alignment: 'center' as const,
                fontSize: 9,
                bold: true,
                margin: [0, 5, 0, 0] as [number, number, number, number],
              },
              {
                text: 'GERENTE GENERAL',
                alignment: 'center' as const,
                fontSize: 8,
                margin: [0, 5, 0, 0] as [number, number, number, number],
              },
            ],
            width: '34%',
          },
          {
            stack: [
              // Espacio reservado EXACTO de 60px - igual que comisionista
              {
                text: ' ',
                fontSize: 1,
                margin: [0, 60, 0, 0] as [number, number, number, number], // Exactamente 60px de espacio
              },
              // SIEMPRE mostrar la línea
              {
                text: '___________________________',
                alignment: 'center' as const,
                fontSize: 8,
              },
              {
                text: accountantName,
                alignment: 'center' as const,
                fontSize: 9,
                bold: true,
                margin: [0, 5, 0, 0] as [number, number, number, number],
              },
            ],
            width: '33%',
          },
        ],
      },
    ],

    footer: (currentPage: number, pageCount: number) => {
      return {
        columns: [
          {
            text: `Generado el ${new Date().toLocaleDateString('es-PE', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}`,
            fontSize: 7,
            color: '#666666',
          },
          {
            text: `Página ${currentPage} de ${pageCount}`,
            fontSize: 7,
            color: '#666666',
            alignment: 'right',
          },
        ],
        margin: [40, 10, 40, 0] as [number, number, number, number],
      };
    },
  };
};
