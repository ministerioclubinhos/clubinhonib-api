import {
  Injectable,
  Optional,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const defaultExecute = promisify(execFile);

export type SofficeExecFn = (
  file: string,
  args: readonly string[],
  options: { timeout: number; maxBuffer: number },
) => Promise<unknown>;

export interface PdfLibreOfficeOptions {
  maxConcurrent?: number;
  queueTimeoutMs?: number;
  execFn?: SofficeExecFn;
}

@Injectable()
export class PdfLibreOfficeService {
  private readonly maxConcurrent: number;
  private readonly queueTimeoutMs: number;
  private readonly execFn: SofficeExecFn;
  private activeCount = 0;
  private readonly waitQueue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }> = [];

  constructor(@Optional() options?: PdfLibreOfficeOptions) {
    const envMax = Number(process.env.AI_LESSONS_MAX_PDF_CONVERSIONS);
    this.maxConcurrent =
      options?.maxConcurrent ??
      (Number.isInteger(envMax) && envMax > 0 ? envMax : 2);
    this.queueTimeoutMs = options?.queueTimeoutMs ?? 60_000;
    this.execFn = options?.execFn ?? defaultExecute;
  }

  private async acquireSlot(): Promise<void> {
    if (this.activeCount < this.maxConcurrent) {
      this.activeCount += 1;
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = this.waitQueue.findIndex((item) => item.timer === timer);
        if (index >= 0) {
          this.waitQueue.splice(index, 1);
        }
        reject(
          new ServiceUnavailableException(
            'Fila de conversão PDF ocupada no momento. Tente novamente em instantes.',
          ),
        );
      }, this.queueTimeoutMs);
      this.waitQueue.push({ resolve, reject, timer });
    });
  }

  private releaseSlot(): void {
    const next = this.waitQueue.shift();
    if (next) {
      clearTimeout(next.timer);
      next.resolve();
      return;
    }
    this.activeCount = Math.max(0, this.activeCount - 1);
  }

  async convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
    await this.acquireSlot();
    const dir = await mkdtemp(join(tmpdir(), 'clubinho-pdf-'));
    const profile = join(dir, 'profile');
    const source = join(dir, 'lesson.docx');
    const output = join(dir, 'lesson.pdf');
    try {
      await writeFile(source, docxBuffer);
      await this.execFn(
        'soffice',
        [
          `-env:UserInstallation=file://${profile}`,
          '--headless',
          '--nologo',
          '--nodefault',
          '--nolockcheck',
          '--norestore',
          '--convert-to',
          'pdf',
          '--outdir',
          dir,
          source,
        ],
        { timeout: 90000, maxBuffer: 1024 * 1024 },
      );
      const pdf = await readFile(output);
      if (pdf.length < 5 || pdf.subarray(0, 5).toString() !== '%PDF-')
        throw new UnprocessableEntityException(
          'LibreOffice não produziu um PDF válido.',
        );
      return pdf;
    } catch (error: unknown) {
      if (
        error instanceof UnprocessableEntityException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      throw new ServiceUnavailableException(
        `Falha na conversão PDF pelo LibreOffice: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
      this.releaseSlot();
    }
  }
}
