import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  assertSafeImageUrl,
  assertSafeIpAddress,
  assertValidImageBuffer,
  downloadSafeImageBuffer,
  extractAuthorizedStudioBucketKey,
} from './asset-url.utils';

const VALID_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52,
]);

const VALID_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

describe('assertSafeImageUrl & downloadSafeImageBuffer (BE01 SSRF and asset safety)', () => {
  it('permite URLs HTTPS públicas legítimas', () => {
    expect(() =>
      assertSafeImageUrl('https://s3.amazonaws.com/my-bucket/image.png'),
    ).not.toThrow();
    expect(() =>
      assertSafeImageUrl('https://cdn.clubinhonib.com.br/assets/drawing.jpg'),
    ).not.toThrow();
    expect(() =>
      assertSafeImageUrl('http://example.com/asset.png'),
    ).not.toThrow();
  });

  it('rejeita URLs mal formatadas, protocolos inválidos, credenciais e portas restritas', () => {
    expect(() => assertSafeImageUrl('not-a-url')).toThrow(BadRequestException);
    expect(() => assertSafeImageUrl('ftp://example.com/image.png')).toThrow(
      BadRequestException,
    );
    expect(() => assertSafeImageUrl('file:///etc/passwd')).toThrow(
      BadRequestException,
    );
    expect(() =>
      assertSafeImageUrl('https://user:pass@example.com/image.png'),
    ).toThrow(BadRequestException);
    expect(() =>
      assertSafeImageUrl('https://example.com:8443/image.png'),
    ).toThrow(BadRequestException);
  });

  it('rejeita localhost e hosts internos', () => {
    expect(() => assertSafeImageUrl('http://localhost:3000/asset.png')).toThrow(
      BadRequestException,
    );
    expect(() =>
      assertSafeImageUrl('http://my-service.local/image.png'),
    ).toThrow(BadRequestException);
    expect(() =>
      assertSafeImageUrl('http://backend.internal/image.png'),
    ).toThrow(BadRequestException);
    expect(() =>
      assertSafeImageUrl('http://metadata.google.internal/computeMetadata/v1/'),
    ).toThrow(BadRequestException);
  });

  it('rejeita IPs privados e de metadados IPv4 (SSRF)', () => {
    expect(() => assertSafeImageUrl('http://127.0.0.1/secrets')).toThrow(
      BadRequestException,
    );
    expect(() => assertSafeImageUrl('http://0.0.0.0/secrets')).toThrow(
      BadRequestException,
    );
    expect(() =>
      assertSafeImageUrl('http://169.254.169.254/latest/meta-data/'),
    ).toThrow(BadRequestException);
    expect(() => assertSafeImageUrl('http://10.0.0.1/admin')).toThrow(
      BadRequestException,
    );
    expect(() => assertSafeImageUrl('http://172.16.5.10/internal')).toThrow(
      BadRequestException,
    );
    expect(() => assertSafeImageUrl('http://192.168.1.1/router')).toThrow(
      BadRequestException,
    );
    expect(() => assertSafeImageUrl('http://100.64.0.1/cgnat')).toThrow(
      BadRequestException,
    );
  });

  it('rejeita endereços IPv6 de loopback, link-local, unique-local e mapeados para IPv4 (A04)', () => {
    expect(() => assertSafeImageUrl('http://[::1]/image.png')).toThrow(
      BadRequestException,
    );
    expect(() => assertSafeImageUrl('http://[::]/image.png')).toThrow(
      BadRequestException,
    );
    expect(() =>
      assertSafeImageUrl('http://[::ffff:127.0.0.1]/image.png'),
    ).toThrow(BadRequestException);
    expect(() =>
      assertSafeImageUrl('http://[::ffff:169.254.169.254]/image.png'),
    ).toThrow(BadRequestException);
    expect(() => assertSafeImageUrl('http://[fd00::1]/image.png')).toThrow(
      BadRequestException,
    );
    expect(() => assertSafeImageUrl('http://[fc00::1]/image.png')).toThrow(
      BadRequestException,
    );
    expect(() => assertSafeImageUrl('http://[fe80::1]/image.png')).toThrow(
      BadRequestException,
    );
    expect(() => assertSafeIpAddress('::ffff:10.0.0.1')).toThrow(
      BadRequestException,
    );
  });

  it('extrai somente chaves válidas do bucket configurado no prefixo de uploads', () => {
    expect(
      extractAuthorizedStudioBucketKey(
        'https://clubinho-bucket.s3.amazonaws.com/prod/uploads/lesson-1-visual-01.png',
        'clubinho-bucket',
      ),
    ).toBe('prod/uploads/lesson-1-visual-01.png');
    expect(
      extractAuthorizedStudioBucketKey(
        'https://s3.us-east-1.amazonaws.com/clubinho-bucket/uploads/item.png',
        'clubinho-bucket',
      ),
    ).toBe('uploads/item.png');
    expect(
      extractAuthorizedStudioBucketKey(
        'https://other-bucket.s3.amazonaws.com/prod/uploads/item.png',
        'clubinho-bucket',
      ),
    ).toBeNull();
    expect(
      extractAuthorizedStudioBucketKey(
        'https://clubinho-bucket.s3.amazonaws.com/private/secret.txt',
        'clubinho-bucket',
      ),
    ).toBeNull();
  });

  it('valida assinatura binária e tamanho máximo do buffer de imagem', () => {
    expect(assertValidImageBuffer(VALID_PNG_BUFFER)).toBe('png');
    expect(assertValidImageBuffer(VALID_JPEG_BUFFER)).toBe('jpeg');
    expect(() =>
      assertValidImageBuffer(Buffer.from('<html>not an image</html>')),
    ).toThrow(UnprocessableEntityException);
    expect(() => assertValidImageBuffer(VALID_PNG_BUFFER, 8)).toThrow(
      UnprocessableEntityException,
    );
  });

  it('rejeita hostname público que resolve para IP privado ou metadados via DNS', async () => {
    const httpGet = jest.fn();
    await expect(
      downloadSafeImageBuffer('https://evil.example.com/image.png', {
        dnsResolver: () =>
          Promise.resolve([{ address: '169.254.169.254', family: 4 }]),
        httpGet,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(httpGet).not.toHaveBeenCalled();

    await expect(
      downloadSafeImageBuffer('https://evil6.example.com/image.png', {
        dnsResolver: () =>
          Promise.resolve([{ address: '::ffff:127.0.0.1', family: 6 }]),
        httpGet,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(httpGet).not.toHaveBeenCalled();
  });

  it('rejeita redirecionamentos para loopback/metadados ou externos', async () => {
    await expect(
      downloadSafeImageBuffer('https://cdn.example.com/image.png', {
        dnsResolver: () =>
          Promise.resolve([{ address: '93.184.216.34', family: 4 }]),
        httpGet: () =>
          Promise.resolve({
            status: 302,
            headers: { location: 'http://169.254.169.254/latest/meta-data/' },
            data: Buffer.alloc(0),
          }),
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      downloadSafeImageBuffer('https://cdn.example.com/image.png', {
        dnsResolver: () =>
          Promise.resolve([{ address: '93.184.216.34', family: 4 }]),
        httpGet: () =>
          Promise.resolve({
            status: 301,
            headers: { location: 'https://other.example.com/image.png' },
            data: Buffer.alloc(0),
          }),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('utiliza leitor autorizado do S3 quando a URL pertence ao bucket configurado e valida assinatura', async () => {
    const s3KeyReader = jest.fn().mockResolvedValue(VALID_PNG_BUFFER);
    const httpGet = jest.fn();
    const result = await downloadSafeImageBuffer(
      'https://my-bucket.s3.amazonaws.com/local/uploads/test-image.png',
      {
        bucketName: 'my-bucket',
        s3KeyReader,
        httpGet,
      },
    );
    expect(result).toEqual(VALID_PNG_BUFFER);
    expect(s3KeyReader).toHaveBeenCalledWith('local/uploads/test-image.png');
    expect(httpGet).not.toHaveBeenCalled();
  });
});
