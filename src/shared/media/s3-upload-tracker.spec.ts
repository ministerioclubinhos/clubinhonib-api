import { S3UploadTracker } from './s3-upload-tracker';

const file = (name: string): Express.Multer.File =>
  ({ originalname: name }) as Express.Multer.File;

describe('S3UploadTracker', () => {
  it('registra cada URL enviada, na ordem', async () => {
    const upload = jest
      .fn()
      .mockResolvedValueOnce('https://s3/a.png')
      .mockResolvedValueOnce('https://s3/b.png');
    const tracker = new S3UploadTracker(upload);

    await tracker.upload(file('a.png'));
    await tracker.upload(file('b.png'));

    expect(tracker.uploadedUrls).toEqual([
      'https://s3/a.png',
      'https://s3/b.png',
    ]);
  });

  it('devolve a URL de quem chamou', async () => {
    const tracker = new S3UploadTracker(
      jest.fn().mockResolvedValue('https://s3/a.png'),
    );

    await expect(tracker.upload(file('a.png'))).resolves.toBe(
      'https://s3/a.png',
    );
  });

  it('não registra nada quando o upload falha', async () => {
    const tracker = new S3UploadTracker(
      jest.fn().mockRejectedValue(new Error('s3 fora do ar')),
    );

    await expect(tracker.upload(file('a.png'))).rejects.toThrow(
      's3 fora do ar',
    );
    expect(tracker.uploadedUrls).toEqual([]);
  });

  it('entrega uma cópia da lista, que não pode ser alterada por fora', async () => {
    const tracker = new S3UploadTracker(
      jest.fn().mockResolvedValue('https://s3/a.png'),
    );
    await tracker.upload(file('a.png'));

    tracker.uploadedUrls.push('https://s3/intruso.png');

    expect(tracker.uploadedUrls).toEqual(['https://s3/a.png']);
  });

  it('pode ser passado como função de upload, sem perder o this', async () => {
    const upload = jest.fn().mockResolvedValue('https://s3/a.png');
    const tracker = new S3UploadTracker(upload);

    const uploadFn = tracker.upload;
    await uploadFn(file('a.png'));

    expect(tracker.uploadedUrls).toEqual(['https://s3/a.png']);
  });
});
