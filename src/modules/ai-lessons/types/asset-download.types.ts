import type { AxiosRequestConfig, AxiosResponse } from 'axios';

export interface ResolvedDnsRecord {
  address: string;
  family: number;
}

export type DnsResolverFn = (hostname: string) => Promise<ResolvedDnsRecord[]>;

export type HttpGetBufferFn = (
  url: string,
  config: AxiosRequestConfig,
) => Promise<
  Pick<AxiosResponse<ArrayBuffer | Buffer>, 'status' | 'headers' | 'data'>
>;

export type ImageSignature = 'png' | 'jpeg' | 'webp';

export interface SafeImageDownloadOptions {
  maxBytes?: number;
  /** Socket inactivity timeout. */
  timeoutMs?: number;
  /** Absolute ceiling for the whole download. */
  totalTimeoutMs?: number;
  bucketName?: string;
  /** Reads an object of the authorised bucket through the SDK (no public URL needed). */
  s3ObjectReader?: (key: string, url: string) => Promise<Buffer | null>;
  onS3ReadFailure?: (key: string, error: unknown) => void;
  dnsResolver?: DnsResolverFn;
  httpGet?: HttpGetBufferFn;
}
