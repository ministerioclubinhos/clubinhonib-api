import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import axios, { type AxiosRequestConfig } from 'axios';
import * as http from 'node:http';
import type { AddressInfo, LookupFunction } from 'node:net';
import {
  assertSafeImageUrl,
  assertSafeIpAddress,
  assertValidImageBuffer,
  createPinnedLookup,
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
    const s3ObjectReader = jest.fn().mockResolvedValue(VALID_PNG_BUFFER);
    const httpGet = jest.fn();
    const url =
      'https://my-bucket.s3.amazonaws.com/local/uploads/test-image.png';
    const result = await downloadSafeImageBuffer(url, {
      bucketName: 'my-bucket',
      s3ObjectReader,
      httpGet,
    });
    expect(result).toEqual(VALID_PNG_BUFFER);
    expect(s3ObjectReader).toHaveBeenCalledWith(
      'local/uploads/test-image.png',
      url,
    );
    expect(httpGet).not.toHaveBeenCalled();
  });

  it('recorre ao download HTTP fixado quando a leitura direta do S3 falha', async () => {
    const onS3ReadFailure = jest.fn();
    const httpGet = jest.fn().mockResolvedValue({
      status: 200,
      headers: {},
      data: VALID_PNG_BUFFER,
    });
    const result = await downloadSafeImageBuffer(
      'https://my-bucket.s3.us-east-2.amazonaws.com/local/uploads/test-image.png',
      {
        bucketName: 'my-bucket',
        s3ObjectReader: jest.fn().mockRejectedValue(new Error('AccessDenied')),
        onS3ReadFailure,
        httpGet,
        dnsResolver: () =>
          Promise.resolve([{ address: '52.216.0.1', family: 4 }]),
      },
    );
    expect(result).toEqual(VALID_PNG_BUFFER);
    expect(onS3ReadFailure).toHaveBeenCalledWith(
      'local/uploads/test-image.png',
      expect.any(Error),
    );
    expect(httpGet).toHaveBeenCalledTimes(1);
  });

  it('não confunde hosts parecidos com o bucket autorizado', () => {
    const key = 'local/uploads/test-image.png';
    expect(
      extractAuthorizedStudioBucketKey(
        `https://my-bucket.s3.us-east-2.amazonaws.com/${key}`,
        'my-bucket',
      ),
    ).toBe(key);
    expect(
      extractAuthorizedStudioBucketKey(
        `https://s3.us-east-2.amazonaws.com/my-bucket/${key}`,
        'my-bucket',
      ),
    ).toBe(key);
    for (const host of [
      'my-bucket.s3evil.amazonaws.com',
      'my-bucket.s3.amazonaws.com.evil.example',
      'my-bucket-other.s3.amazonaws.com',
      's3evil.amazonaws.com',
    ]) {
      expect(
        extractAuthorizedStudioBucketKey(`https://${host}/${key}`, 'my-bucket'),
      ).toBeNull();
    }
  });

  it('bloqueia faixas reservadas adicionais em IPv4 e IPv6', () => {
    for (const address of [
      '192.88.99.1',
      '100::1',
      '2001:2::1',
      '2001:10::1',
      '2001:20::1',
      '3fff::1',
    ]) {
      expect(() => assertSafeIpAddress(address)).toThrow(BadRequestException);
    }
    expect(() => assertSafeIpAddress('2001:4860:4860::8888')).not.toThrow();
  });
});

describe('pinned DNS lookup (BE01 — Node >= 20 autoSelectFamily)', () => {
  const record = { address: '203.0.114.7', family: 4 };

  it('responde no formato de array quando o Node pede all: true e no formato posicional caso contrário', () => {
    const lookup = createPinnedLookup(record);
    const all = jest.fn();
    lookup('asset.example.com', { all: true }, all);
    expect(all).toHaveBeenCalledWith(null, [record]);

    const single = jest.fn();
    lookup('asset.example.com', { all: false }, single);
    expect(single).toHaveBeenCalledWith(null, record.address, record.family);
  });

  it('fixa o IP resolvido nos dois agentes, desliga proxy e redirecionamentos e limita a duração total', async () => {
    let captured: AxiosRequestConfig | undefined;
    await downloadSafeImageBuffer('https://cdn.example.com/image.png', {
      dnsResolver: () => Promise.resolve([record]),
      httpGet: (_url, config) => {
        captured = config;
        return Promise.resolve({
          status: 200,
          headers: {},
          data: VALID_PNG_BUFFER,
        });
      },
    });
    expect(captured?.proxy).toBe(false);
    expect(captured?.maxRedirects).toBe(0);
    expect(captured?.signal).toBeDefined();
    for (const agent of [captured?.httpAgent, captured?.httpsAgent] as Array<
      http.Agent & { options: { lookup?: LookupFunction } }
    >) {
      const callback = jest.fn();
      agent.options.lookup?.('cdn.example.com', { all: true }, callback);
      expect(callback).toHaveBeenCalledWith(null, [record]);
    }
  });

  it('conecta de verdade pelo axios + agent ao endereço fixado, mantendo o Host original (somente loopback)', async () => {
    const hosts: string[] = [];
    const server = http.createServer((request, response) => {
      hosts.push(String(request.headers.host));
      response.end('ok');
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const { port } = server.address() as AddressInfo;
    const lookup = createPinnedLookup({ address: '127.0.0.1', family: 4 });
    const agent = new http.Agent({ lookup });
    try {
      // The hostname does not resolve: only the pinned lookup can connect.
      const response = await axios.get<string>(
        `http://pinned-host.invalid:${port}/image.png`,
        { httpAgent: agent, proxy: false, maxRedirects: 0 },
      );
      expect(response.status).toBe(200);
      expect(hosts).toEqual([`pinned-host.invalid:${port}`]);
    } finally {
      agent.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
