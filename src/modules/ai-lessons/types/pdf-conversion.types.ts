export interface SofficeExecOptions {
  timeout: number;
  maxBuffer: number;
}

export type SofficeExecFn = (
  file: string,
  args: readonly string[],
  options: SofficeExecOptions,
) => Promise<unknown>;

export type PdfSourceExtension = '.doc' | '.docx';

export interface PdfLibreOfficeOptions {
  maxConcurrent?: number;
  /** Conversions allowed to wait for a slot before new ones are refused. */
  maxQueued?: number;
  queueTimeoutMs?: number;
  conversionTimeoutMs?: number;
  cacheMaxEntries?: number;
  cacheMaxBytes?: number;
  execFn?: SofficeExecFn;
  /** Overridable for tests; defaults to the system temporary directory. */
  temporaryRoot?: string;
}

export interface PdfConversionWaiter {
  resolve: () => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}
