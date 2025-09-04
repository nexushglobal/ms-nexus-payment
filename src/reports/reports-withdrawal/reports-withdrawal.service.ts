import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { FilesService } from 'src/common/services/files.service';
import { PointsService } from 'src/common/services/points.service';
import { WithdrawalsService } from 'src/withdrawals/withdrawals.service';
import { createMulterFile } from '../helpers/create-multer-file.helper';
import { pdfToBuffer } from '../helpers/pdf-to-buffer.helper';
import { PrinterService } from '../printer/printer.service';
import { getLiquidationReport } from './templates/liquidation.template';

@Injectable()
export class ReportsWithdrawalService {
  constructor(
    @Inject(forwardRef(() => WithdrawalsService))
    private readonly withdrawalsService: WithdrawalsService,
    private readonly printerService: PrinterService,
    private readonly filesService: FilesService,
    private readonly pointsService: PointsService,
  ) {}

  async generateLiquidation(
    withdrawalId: number,
    userDocumentNumber: string,
    userRazonSocial: string,
    commissionistSignatureImage?: string,
  ): Promise<{ url: string }> {
    const withdrawal =
      await this.withdrawalsService.findOneWithdrawalWithReport(withdrawalId);
    const liquidationNumber = String(withdrawal.id).padStart(6, '0');
    const volumeHistory = await this.pointsService.getUserVolumeHistory(
      withdrawal.user.id,
      1,
      100,
    );
    const pointsHistory = await this.pointsService.getUserPointsTransactions(
      withdrawal.user.id,
      1,
      100,
    );
    const docDefinition = getLiquidationReport({
      title: `LIQUIDACION N° ${liquidationNumber}`,
      liquidationNumber,
      withdrawal,
      userDocumentNumber,
      userRazonSocial,
      commissionistSignatureImage,
      volumeHistory,
      pointsHistory,
    });
    const doc = this.printerService.createPdf(docDefinition);
    const pdfBuffer = await pdfToBuffer(doc);
    const fileName = `liquidacion-${liquidationNumber}-${userDocumentNumber}.pdf`;
    const file = createMulterFile(
      {
        originalname: fileName,
        mimetype: 'application/pdf',
      },
      pdfBuffer,
    );
    // Subir el archivo a AWS S3
    const uploadResult = await this.filesService.uploadImage(file);
    return { url: uploadResult.url };
  }
}
