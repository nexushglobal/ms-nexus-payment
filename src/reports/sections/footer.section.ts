import { Content } from 'pdfmake/interfaces';

export const footerSection = (
  currentPage: number,
  pageCount: number,
): Content => {
  return {
    columns: [
      {
        text: `Generado el ${new Date().toLocaleDateString('es-PE', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}`,
        style: {
          fontSize: 8,
          color: '#666666',
        },
        margin: [40, 10, 0, 0],
      },
      {
        text: `Página ${currentPage} de ${pageCount}`,
        style: {
          fontSize: 8,
          color: '#666666',
          alignment: 'right',
        },
        margin: [0, 10, 40, 0],
      },
    ],
  };
};
