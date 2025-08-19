export const createMulterFile = (
  file: any,
  buffer: Buffer,
): Express.Multer.File => {
  // Detectar mimetype basado en la extensión si no se proporciona
  const getMimeType = (filename: string) => {
    if (filename.endsWith('.pdf')) return 'application/pdf';
    if (filename.endsWith('.png')) return 'image/png';
    if (filename.endsWith('.jpg') || filename.endsWith('.jpeg'))
      return 'image/jpeg';
    return 'application/octet-stream';
  };

  return {
    fieldname: file.fieldname || 'file',
    originalname: file.originalname,
    encoding: file.encoding || '7bit',
    mimetype: file.mimetype || getMimeType(file.originalname as string),
    size: buffer.length,
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
    buffer,
  };
};
