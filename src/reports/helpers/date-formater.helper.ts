export class DateFormater {
  static formater = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  static getDDMMMMYYYY(date: Date | string): string {
    const parsedDate = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(parsedDate.getTime())) return 'Fecha inválida';
    return this.formater.format(parsedDate);
  }
}
