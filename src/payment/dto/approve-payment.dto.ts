export class ApprovePaymentDto {
  codeOperation?: string;
  banckName: string;
  dateOperation: string;
  numberTicket?: string;
}

export class RejectPaymentDto {
  reason: string;
}

export class CompletePaymentDto {
  codeOperation?: string;
  numberTicket?: string;
}
