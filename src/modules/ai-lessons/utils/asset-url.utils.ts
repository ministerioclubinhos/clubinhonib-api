import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { lookup as dnsLookup } from 'node:dns/promises';
import * as http from 'node:http';
import * as https from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  ASSET_ALLOWED_PORTS,
  ASSET_FORBIDDEN_HOSTNAMES,
  ASSET_FORBIDDEN_HOSTNAME_SUFFIXES,
  DEFAULT_IMAGE_DOWNLOAD_TIMEOUT_MS,
  DEFAULT_IMAGE_DOWNLOAD_TOTAL_TIMEOUT_MS,
  DEFAULT_MAX_IMAGE_ASSET_BYTES,
} from '../constants/asset-download.constants';
import type {
  DnsResolverFn,
  HttpGetBufferFn,
  ImageSignature,
  ResolvedDnsRecord,
  SafeImageDownloadOptions,
} from '../types/asset-download.types';

export {
  DEFAULT_IMAGE_DOWNLOAD_TIMEOUT_MS,
  DEFAULT_IMAGE_DOWNLOAD_TOTAL_TIMEOUT_MS,
  DEFAULT_MAX_IMAGE_ASSET_BYTES,
} from '../constants/asset-download.constants';
export type {
  DnsResolverFn,
  HttpGetBufferFn,
  ImageSignature,
  ResolvedDnsRecord,
  SafeImageDownloadOptions,
} from '../types/asset-download.types';

export function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) {
    return false;
  }
  const nums = parts.map(Number);
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false;
  }
  const [b0, b1, b2] = nums;
  // 0.0.0.0/8 (unspecified / current network) and 127.0.0.0/8 (loopback)
  if (b0 === 0 || b0 === 127) return true;
  // 10.0.0.0/8 (private)
  if (b0 === 10) return true;
  // 100.64.0.0/10 (CGNAT)
  if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;
  // 169.254.0.0/16 (link-local, cloud metadata)
  if (b0 === 169 && b1 === 254) return true;
  // 172.16.0.0/12 (private)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
  // 192.0.0.0/24 (IETF protocol assignments) & 192.0.2.0/24 (TEST-NET-1)
  if (b0 === 192 && b1 === 0 && (b2 === 0 || b2 === 2)) return true;
  // 192.88.99.0/24 (deprecated 6to4 relay anycast)
  if (b0 === 192 && b1 === 88 && b2 === 99) return true;
  // 192.168.0.0/16 (private)
  if (b0 === 192 && b1 === 168) return true;
  // 198.18.0.0/15 (benchmarking) & 198.51.100.0/24 (TEST-NET-2)
  if (b0 === 198 && (b1 === 18 || b1 === 19 || (b1 === 51 && b2 === 100))) {
    return true;
  }
  // 203.0.113.0/24 (TEST-NET-3)
  if (b0 === 203 && b1 === 0 && b2 === 113) return true;
  // 224.0.0.0/4 (multicast) and 240.0.0.0/4 (reserved/broadcast)
  if (b0 >= 224) return true;
  return false;
}

export function parseIpv6Groups(rawIpv6: string): number[] | null {
  const withoutZone = rawIpv6.split('%')[0].toLowerCase();
  if (!withoutZone) return null;

  let working = withoutZone;
  const lastColon = working.lastIndexOf(':');
  if (lastColon !== -1 && working.slice(lastColon + 1).includes('.')) {
    const ipv4Part = working.slice(lastColon + 1);
    const parts = ipv4Part.split('.');
    if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p))) {
      return null;
    }
    const nums = parts.map(Number);
    if (nums.some((n) => n < 0 || n > 255)) return null;
    const high = ((nums[0] << 8) | nums[1]).toString(16);
    const low = ((nums[2] << 8) | nums[3]).toString(16);
    working = `${working.slice(0, lastColon)}:${high}:${low}`;
  }

  const doubleColonParts = working.split('::');
  if (doubleColonParts.length > 2) return null;

  const parseSegmentList = (segment: string): number[] | null => {
    if (!segment) return [];
    const tokens = segment.split(':');
    const result: number[] = [];
    for (const token of tokens) {
      if (!/^[0-9a-f]{1,4}$/.test(token)) return null;
      result.push(parseInt(token, 16));
    }
    return result;
  };

  if (doubleColonParts.length === 2) {
    const left = parseSegmentList(doubleColonParts[0]);
    const right = parseSegmentList(doubleColonParts[1]);
    if (!left || !right) return null;
    const missing = 8 - (left.length + right.length);
    if (missing < 1) return null;
    return [...left, ...new Array<number>(missing).fill(0), ...right];
  }

  const groups = parseSegmentList(working);
  if (!groups || groups.length !== 8) return null;
  return groups;
}

function groupsToIpv4String(high16: number, low16: number): string {
  const b0 = (high16 >> 8) & 0xff;
  const b1 = high16 & 0xff;
  const b2 = (low16 >> 8) & 0xff;
  const b3 = low16 & 0xff;
  return `${b0}.${b1}.${b2}.${b3}`;
}

export function isPrivateOrReservedIpv6(ip: string): boolean {
  const groups = parseIpv6Groups(ip);
  if (!groups) return true;

  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;

  // Unspecified ::/128
  if (groups.every((g) => g === 0)) return true;

  // Loopback ::1/128
  if (
    g0 === 0 &&
    g1 === 0 &&
    g2 === 0 &&
    g3 === 0 &&
    g4 === 0 &&
    g5 === 0 &&
    g6 === 0 &&
    g7 === 1
  ) {
    return true;
  }

  // IPv4-mapped ::ffff:0:0/96 or IPv4-translated ::ffff:0:0:0/96
  if (
    g0 === 0 &&
    g1 === 0 &&
    g2 === 0 &&
    g3 === 0 &&
    ((g4 === 0 && g5 === 0xffff) || (g4 === 0xffff && g5 === 0))
  ) {
    return isPrivateIpv4(groupsToIpv4String(g6, g7));
  }

  // IPv4-compatible ::/96
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
    return isPrivateIpv4(groupsToIpv4String(g6, g7));
  }

  // NAT64 64:ff9b::/96 and 64:ff9b:1::/48
  if (g0 === 0x0064 && g1 === 0xff9b) {
    return isPrivateIpv4(groupsToIpv4String(g6, g7));
  }

  // 6to4 2002::/16
  if (g0 === 0x2002) {
    return isPrivateIpv4(groupsToIpv4String(g1, g2));
  }

  // Teredo 2001:0000::/32 or Documentation 2001:db8::/32
  if (g0 === 0x2001 && (g1 === 0x0000 || g1 === 0x0db8)) {
    return true;
  }

  // Benchmarking 2001:2::/48, ORCHID 2001:10::/28 and ORCHIDv2 2001:20::/28
  if (
    g0 === 0x2001 &&
    ((g1 === 0x0002 && g2 === 0) ||
      (g1 & 0xfff0) === 0x0010 ||
      (g1 & 0xfff0) === 0x0020)
  ) {
    return true;
  }

  // Discard-only 100::/64
  if (g0 === 0x0100 && g1 === 0 && g2 === 0 && g3 === 0) return true;

  // Documentation 3fff::/20
  if (g0 === 0x3fff && (g1 & 0xf000) === 0) return true;

  // Unique local fc00::/7 (fc00:: - fdff::)
  if ((g0 & 0xfe00) === 0xfc00) return true;

  // Link-local fe80::/10
  if ((g0 & 0xffc0) === 0xfe80) return true;

  // Site-local fec0::/10 (deprecated)
  if ((g0 & 0xffc0) === 0xfec0) return true;

  // Multicast ff00::/8
  if ((g0 & 0xff00) === 0xff00) return true;

  return false;
}

export function normalizeUrlHostname(rawHostname: string): string {
  const lower = rawHostname.trim().toLowerCase();
  if (lower.startsWith('[') && lower.endsWith(']')) {
    return lower.slice(1, -1);
  }
  return lower;
}

export function assertSafeIpAddress(ipAddress: string): void {
  const normalized = normalizeUrlHostname(ipAddress);
  const withoutZone = normalized.split('%')[0];
  const family = isIP(withoutZone);

  if (family === 4) {
    if (isPrivateIpv4(withoutZone)) {
      throw new BadRequestException(
        'Acesso a endereço IP privado ou de metadados não é permitido.',
      );
    }
    return;
  }

  if (family === 6 || normalized.includes(':')) {
    if (isPrivateOrReservedIpv6(normalized)) {
      throw new BadRequestException(
        'Acesso a endereço IPv6 local ou privado não é permitido.',
      );
    }
    return;
  }

  throw new BadRequestException('Endereço IP do asset é inválido.');
}

export function assertSafeImageUrl(urlString: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new BadRequestException('URL do asset é inválida.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException('Protocolo do asset deve ser HTTP ou HTTPS.');
  }

  if (parsed.username || parsed.password) {
    throw new BadRequestException(
      'Credenciais na URL do asset não são permitidas.',
    );
  }

  if (!ASSET_ALLOWED_PORTS.has(parsed.port)) {
    throw new BadRequestException('Porta na URL do asset não é permitida.');
  }

  const rawHostname = parsed.hostname.toLowerCase();
  const hostname = normalizeUrlHostname(rawHostname);

  if (
    !hostname ||
    ASSET_FORBIDDEN_HOSTNAMES.has(hostname) ||
    ASSET_FORBIDDEN_HOSTNAME_SUFFIXES.some((suffix) =>
      hostname.endsWith(suffix),
    )
  ) {
    throw new BadRequestException(
      'Acesso a host interno ou local não é permitido.',
    );
  }

  if (rawHostname.startsWith('[') || hostname.includes(':')) {
    if (isPrivateOrReservedIpv6(hostname)) {
      throw new BadRequestException(
        'Acesso a endereço IPv6 local ou privado não é permitido.',
      );
    }
    return parsed;
  }

  if (isPrivateIpv4(hostname)) {
    throw new BadRequestException(
      'Acesso a endereço IP privado ou de metadados não é permitido.',
    );
  }

  return parsed;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `bucket.s3.amazonaws.com` or `bucket.s3[.-]region.amazonaws.com` only. */
export function isVirtualHostedBucketHost(
  hostname: string,
  bucketName: string,
): boolean {
  return new RegExp(
    `^${escapeRegExp(bucketName.toLowerCase())}\\.s3(?:[.-][a-z0-9-]+)*\\.amazonaws\\.com$`,
  ).test(hostname.toLowerCase());
}

/** `s3.amazonaws.com` or `s3[.-]region.amazonaws.com` only. */
export function isPathStyleS3Host(hostname: string): boolean {
  return /^s3(?:[.-][a-z0-9-]+)*\.amazonaws\.com$/.test(hostname.toLowerCase());
}

export function extractAuthorizedStudioBucketKey(
  urlString: string,
  bucketName?: string,
): string | null {
  if (!bucketName) return null;
  let parsed: URL;
  try {
    parsed = assertSafeImageUrl(urlString);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname.endsWith('.amazonaws.com')) return null;

  let key = '';
  const decodedPath = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
  if (!decodedPath || decodedPath.includes('..')) return null;

  const pathPrefix = `${bucketName}/`;
  if (isVirtualHostedBucketHost(hostname, bucketName)) {
    key = decodedPath;
  } else if (
    isPathStyleS3Host(hostname) &&
    decodedPath.startsWith(pathPrefix)
  ) {
    key = decodedPath.slice(pathPrefix.length);
  } else {
    return null;
  }

  if (!key || !/(?:^|\/)uploads\/[^/]+$/.test(key)) {
    return null;
  }
  return key;
}

export function detectImageSignature(buffer: Buffer): ImageSignature | null {
  if (!Buffer.isBuffer(buffer) || buffer.byteLength < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'webp';
  }

  return null;
}

export function assertValidImageBuffer(
  buffer: Buffer,
  maxBytes = DEFAULT_MAX_IMAGE_ASSET_BYTES,
): ImageSignature {
  if (!Buffer.isBuffer(buffer) || buffer.byteLength === 0) {
    throw new UnprocessableEntityException(
      'O arquivo de imagem do asset está vazio ou inacessível.',
    );
  }
  if (buffer.byteLength > maxBytes) {
    throw new UnprocessableEntityException(
      'A imagem do asset excede o tamanho máximo permitido para exportação.',
    );
  }
  const format = detectImageSignature(buffer);
  if (!format) {
    throw new UnprocessableEntityException(
      'O conteúdo retornado para o asset não é uma imagem válida (PNG, JPEG ou WebP).',
    );
  }
  return format;
}

const defaultDnsResolver: DnsResolverFn = async (hostname: string) => {
  const records = await dnsLookup(hostname, { all: true, verbatim: true });
  return records.map((r) => ({ address: r.address, family: r.family }));
};

/**
 * Lookup pinned to the already-validated address. Node >= 20 enables
 * `autoSelectFamily`, which calls the lookup with `all: true` and expects an
 * array; older call sites still expect the positional form.
 */
export function createPinnedLookup(record: ResolvedDnsRecord): LookupFunction {
  return (_hostname, options, callback): void => {
    if (options.all) {
      callback(null, [{ address: record.address, family: record.family }]);
      return;
    }
    callback(null, record.address, record.family);
  };
}

async function readOwnedBucketObject(
  urlString: string,
  options: SafeImageDownloadOptions,
  maxBytes: number,
): Promise<Buffer | null> {
  if (!options.s3ObjectReader || !options.bucketName) return null;
  const bucketKey = extractAuthorizedStudioBucketKey(
    urlString,
    options.bucketName,
  );
  if (!bucketKey) return null;
  let s3Buffer: Buffer | null;
  try {
    s3Buffer = await options.s3ObjectReader(bucketKey, urlString);
  } catch (error: unknown) {
    // The SDK read is an optimisation and the only path for private buckets;
    // the pinned HTTP download below remains the fallback for public objects.
    options.onS3ReadFailure?.(bucketKey, error);
    return null;
  }
  if (!s3Buffer) return null;
  assertValidImageBuffer(s3Buffer, maxBytes);
  return s3Buffer;
}

export async function downloadSafeImageBuffer(
  urlString: string,
  options: SafeImageDownloadOptions = {},
): Promise<Buffer> {
  const parsed = assertSafeImageUrl(urlString);
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_IMAGE_ASSET_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_IMAGE_DOWNLOAD_TIMEOUT_MS;
  const totalTimeoutMs =
    options.totalTimeoutMs ?? DEFAULT_IMAGE_DOWNLOAD_TOTAL_TIMEOUT_MS;

  const ownedObject = await readOwnedBucketObject(urlString, options, maxBytes);
  if (ownedObject) return ownedObject;

  const hostname = normalizeUrlHostname(parsed.hostname);
  const literalFamily = isIP(hostname.split('%')[0]);
  let pinnedRecord: ResolvedDnsRecord | null = null;

  if (literalFamily === 4 || literalFamily === 6) {
    assertSafeIpAddress(hostname);
    pinnedRecord = { address: hostname.split('%')[0], family: literalFamily };
  } else if (options.dnsResolver || !options.httpGet) {
    const resolver = options.dnsResolver ?? defaultDnsResolver;
    let records: ResolvedDnsRecord[];
    try {
      records = await resolver(hostname);
    } catch {
      throw new BadRequestException(
        'Não foi possível resolver o host da imagem com segurança.',
      );
    }
    if (!records.length) {
      throw new BadRequestException(
        'O host da imagem não retornou endereços IP válidos.',
      );
    }
    for (const record of records) {
      assertSafeIpAddress(record.address);
    }
    pinnedRecord = records[0];
  }

  const pinnedLookup = pinnedRecord
    ? createPinnedLookup(pinnedRecord)
    : undefined;
  const httpAgent = pinnedLookup
    ? new http.Agent({ lookup: pinnedLookup })
    : undefined;
  const httpsAgent = pinnedLookup
    ? new https.Agent({ lookup: pinnedLookup })
    : undefined;

  const requestConfig: AxiosRequestConfig = {
    responseType: 'arraybuffer',
    // `timeout` only bounds inactivity; the signal bounds the whole transfer.
    timeout: timeoutMs,
    signal: AbortSignal.timeout(totalTimeoutMs),
    // Never route through HTTP(S)_PROXY: the pinned lookup must apply to the
    // asset host itself, not to a proxy.
    proxy: false,
    maxRedirects: 0,
    maxContentLength: maxBytes,
    maxBodyLength: maxBytes,
    decompress: true,
    validateStatus: (status) => status >= 200 && status < 400,
    ...(httpAgent && httpsAgent ? { httpAgent, httpsAgent } : {}),
  };

  const httpGet: HttpGetBufferFn =
    options.httpGet ?? ((url, cfg) => axios.get<ArrayBuffer>(url, cfg));

  let response: Pick<
    AxiosResponse<ArrayBuffer | Buffer>,
    'status' | 'headers' | 'data'
  >;
  try {
    response = await httpGet(parsed.toString(), requestConfig);
  } catch (error: unknown) {
    if (
      error instanceof BadRequestException ||
      error instanceof UnprocessableEntityException
    ) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    if (/maxContentLength|maxBodyLength/i.test(message)) {
      throw new UnprocessableEntityException(
        'A imagem do asset excede o tamanho máximo permitido para exportação.',
      );
    }
    throw new UnprocessableEntityException(
      'Não foi possível baixar uma imagem necessária para gerar o documento.',
    );
  } finally {
    httpAgent?.destroy();
    httpsAgent?.destroy();
  }

  if (response.status >= 300 && response.status < 400) {
    const location =
      typeof response.headers?.location === 'string'
        ? response.headers.location
        : '';
    if (location) {
      assertSafeImageUrl(new URL(location, parsed).toString());
    }
    throw new BadRequestException(
      'Redirecionamentos externos não são permitidos na leitura de assets.',
    );
  }

  const buffer = Buffer.isBuffer(response.data)
    ? response.data
    : Buffer.from(response.data);
  assertValidImageBuffer(buffer, maxBytes);
  return buffer;
}
