import { Injectable } from '@nestjs/common';
import PdfPrinter from 'pdfmake';
import { BufferOptions, TDocumentDefinitions } from 'pdfmake/interfaces';
import { fontsDescriptors } from '../constants/constants';

@Injectable()
export class PrinterService {
  private printer = new PdfPrinter(fontsDescriptors);

  createPdf(
    docDefinition: TDocumentDefinitions,
    options?: BufferOptions,
  ): PDFKit.PDFDocument {
    return this.printer.createPdfKitDocument(docDefinition, options);
  }
}
