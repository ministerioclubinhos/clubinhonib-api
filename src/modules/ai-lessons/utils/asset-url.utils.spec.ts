import { BadRequestException } from '@nestjs/common';
import { assertSafeImageUrl } from './asset-url.utils';

describe('assertSafeImageUrl (SSRF and asset safety)', () => {
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

  it('rejeita URLs mal formatadas ou com protocolos não HTTP/S', () => {
    expect(() => assertSafeImageUrl('not-a-url')).toThrow(BadRequestException);
    expect(() => assertSafeImageUrl('ftp://example.com/image.png')).toThrow(
      BadRequestException,
    );
    expect(() => assertSafeImageUrl('file:///etc/passwd')).toThrow(
      BadRequestException,
    );
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
  });

  it('rejeita IPs privados e de metadados na nuvem (SSRF)', () => {
    expect(() => assertSafeImageUrl('http://127.0.0.1/secrets')).toThrow(
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
  });
});
