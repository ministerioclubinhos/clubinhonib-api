import { BadRequestException } from '@nestjs/common';

const FORBIDDEN_HOSTNAMES = new Set(['localhost', 'localhost.localdomain']);

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }
  const [b0, b1] = parts;
  // 127.0.0.0/8 (loopback)
  if (b0 === 127 || b0 === 0) return true;
  // 10.0.0.0/8
  if (b0 === 10) return true;
  // 172.16.0.0/12 (172.16 - 172.31)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
  // 192.168.0.0/16
  if (b0 === 192 && b1 === 168) return true;
  // 169.254.0.0/16 (link-local, cloud metadata)
  if (b0 === 169 && b1 === 254) return true;
  // 100.64.0.0/10 (CGNAT)
  if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;
  return false;
}

export function assertSafeImageUrl(urlString: string): void {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new BadRequestException('URL do asset é inválida.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException('Protocolo do asset deve ser HTTP ou HTTPS.');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    FORBIDDEN_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new BadRequestException(
      'Acesso a host interno ou local não é permitido.',
    );
  }

  if (isPrivateIpv4(hostname)) {
    throw new BadRequestException(
      'Acesso a endereço IP privado ou de metadados não é permitido.',
    );
  }

  if (
    hostname === '::1' ||
    hostname.startsWith('fe80:') ||
    hostname.startsWith('fc00:')
  ) {
    throw new BadRequestException(
      'Acesso a endereço IPv6 local não é permitido.',
    );
  }
}
