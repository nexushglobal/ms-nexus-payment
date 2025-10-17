import { TicketStatus } from './ticket-status.enum';

export interface UpdateTicketStatusDto {
  ticketId: number;
  status: TicketStatus;
}
