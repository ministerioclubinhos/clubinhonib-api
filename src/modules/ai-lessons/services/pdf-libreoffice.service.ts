import {
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);

@Injectable()
export class PdfLibreOfficeService {
  async convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
    const dir = await mkdtemp(join(tmpdir(), 'clubinho-pdf-'));
    const profile = join(dir, 'profile');
    const source = join(dir, 'lesson.docx');
    const output = join(dir, 'lesson.pdf');
    try {
      await writeFile(source, docxBuffer);
      await execute(
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
      if (error instanceof UnprocessableEntityException) throw error;
      throw new ServiceUnavailableException(
        `Falha na conversão PDF pelo LibreOffice: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
