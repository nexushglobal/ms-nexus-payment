import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { formatDate } from 'src/reports/helpers/format-date.helper';
import { FindOneWithdrawalWithReportResponseDto } from 'src/withdrawals/dto/find-one-withdrawal-with-report.dto';

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
  } = options;

  // Fecha actual (no createdAt)
  const fechaActual = new Date().toLocaleDateString('es-PE');

  // Procesar withdrawalPoints para la tabla principal
  const tableRows: any[] = [];
  const binaryCommissionTickets: string[] = [];
  let totalAmount = 0;

  withdrawal.withdrawalPoints?.forEach((point) => {
    const metadata = point.metadata || {};
    const tipoTransaccion = metadata.tipo_transaccion || 'RETIRO DE PUNTOS';
    // const planMembresia = metadata.plan_membresia || {};

    totalAmount += point.amountUsed;

    // Si es BINARY_COMMISSION, recopilar tickets y agregar a la lista
    if (tipoTransaccion === 'BINARY_COMMISSION') {
      // Agregar todos los números de boleta de este punto de retiro
      point.paymentsInfo?.forEach((payment) => {
        if (payment.ticketNumber) {
          binaryCommissionTickets.push(payment.ticketNumber);
        }
      });
      return;
    }

    const fecha =
      tipoTransaccion === 'DIRECT_BONUS' && metadata.fecha_creacion
        ? formatDate(metadata.fecha_creacion as Date)
        : '';

    const concepto =
      tipoTransaccion === 'DIRECT_BONUS' ? 'COMISION' : tipoTransaccion;

    // Para COMISION (DIRECT_BONUS), obtener datos del pago (siempre 0 o 1 pago)
    const payment = point.paymentsInfo?.[0] || null;
    const ticketNumber = payment?.ticketNumber || '';
    const operationCode = payment?.operationCode || '';
    const amountPaid = payment?.amount || 0;

    tableRows.push([
      {
        text: (tableRows.length + 1).toString(),
        fontSize: 8,
        alignment: 'center',
      },
      { text: concepto, fontSize: 8, alignment: 'center' },
      { text: ticketNumber, fontSize: 8, alignment: 'center' },
      { text: fecha, fontSize: 8, alignment: 'center' },
      { text: amountPaid.toFixed(2), fontSize: 8, alignment: 'center' }, // IMPORTE: monto del pago
      { text: 'Interbank', fontSize: 8, alignment: 'center' },
      { text: operationCode, fontSize: 8, alignment: 'center' },
      { text: point.amountUsed.toFixed(2), fontSize: 8, alignment: 'center' }, // COMISION: monto de puntos
    ]);
  });

  // Agregar BONO BINARIO como una sola fila si existe
  if (binaryCommissionTickets.length > 0) {
    // IMPORTE: suma de montos de pagos para bono binario
    const binaryPaymentsTotal =
      withdrawal.withdrawalPoints
        ?.filter((p) => p.metadata?.tipo_transaccion === 'BINARY_COMMISSION')
        .reduce((sum, p) => {
          const paymentsSum =
            p.paymentsInfo?.reduce(
              (pSum, payment) => pSum + (payment.amount || 0),
              0,
            ) || 0;
          return sum + paymentsSum;
        }, 0) || 0;

    // COMISION: suma de montos de puntos para bono binario
    const binaryPointsTotal =
      withdrawal.withdrawalPoints
        ?.filter((p) => p.metadata?.tipo_transaccion === 'BINARY_COMMISSION')
        .reduce((sum, p) => sum + p.amountUsed, 0) || 0;

    // const planMembresia =
    //   withdrawal.withdrawalPoints?.[0]?.metadata?.plan_membresia || {};
    // const porcentaje = planMembresia.porcentaje_comision
    //   ? `${planMembresia.porcentaje_comision}%`
    //   : '';

    tableRows.push([
      {
        text: (tableRows.length + 1).toString(),
        fontSize: 8,
        alignment: 'center',
      },
      { text: 'BONO BINARIO', fontSize: 8, alignment: 'center' },
      { text: '', fontSize: 8, alignment: 'center' },
      { text: '', fontSize: 8, alignment: 'center' },
      {
        text: binaryPaymentsTotal.toFixed(2),
        fontSize: 8,
        alignment: 'center',
      }, // IMPORTE: suma de pagos
      { text: 'Interbank', fontSize: 8, alignment: 'center' },
      { text: '', fontSize: 8, alignment: 'center' },
      { text: binaryPointsTotal.toFixed(2), fontSize: 8, alignment: 'center' }, // COMISION: suma de puntos
    ]);
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
            '6%', // ITEM (era 5%)
            '20%', // CONCEPTO (era 16%)
            '12%', // N°BOLETA (era 9%)
            '11%', // FECHA (era 9%)
            '13%', // IMPORTE (era 11%)
            '14%', // BANCO (era 11%)
            '9%', // N° OP (era 7%)
            '15%', // COMISION (era 11%)
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
        },
        margin: [0, 0, 0, 15] as [number, number, number, number],
      },

      // BONO BINARIO con números de boleta en filas separadas (DESPUÉS DE LA TABLA)
      ...(binaryCommissionTickets.length > 0
        ? [
            {
              text: '** BONO BINARIO',
              fontSize: 8,
              bold: true,
              margin: [0, 0, 0, 5] as [number, number, number, number],
            },
            ...binaryCommissionTickets.map((ticketNumber) => ({
              text: `- ${ticketNumber}`,
              fontSize: 8,
              margin: [20, 0, 0, 2] as [number, number, number, number],
            })),
            {
              text: '',
              margin: [0, 10, 0, 0] as [number, number, number, number],
            },
          ]
        : []),

      // Totales alineados con la tabla (DESPUÉS DEL DETALLE DE BONO BINARIO)
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
        margin: [0, 0, 0, 100] as [number, number, number, number],
      },

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
