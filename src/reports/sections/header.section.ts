import { Content } from 'pdfmake/interfaces';

interface HeaderOptions {
  title?: string;
  subtitle?: string;
  imageUrl?: string;
}

export const headerSection = (options: HeaderOptions): Content => {
  const { title, subtitle } = options;

  return {
    margin: [0, 0, 0, 20],
    table: {
      widths: ['*', 'auto'],
      body: [
        [
          {
            stack: [
              {
                text: title || 'NEXUS',
                style: {
                  fontSize: 20,
                  bold: true,
                  color: '#2c5530',
                },
                margin: [0, 10, 0, 5],
              },
              {
                text: subtitle || '',
                style: {
                  fontSize: 12,
                  color: '#666666',
                },
                margin: [0, 0, 0, 10],
              },
            ],
            border: [false, false, false, false],
          },
          {
            text: 'NEXUS',
            style: {
              fontSize: 24,
              bold: true,
              color: 'white',
              alignment: 'center',
            },
            background: '#2c5530',
            margin: [10, 8, 10, 8],
            border: [false, false, false, false],
          },
        ],
      ],
    },
    layout: 'noBorders',
  };
};
