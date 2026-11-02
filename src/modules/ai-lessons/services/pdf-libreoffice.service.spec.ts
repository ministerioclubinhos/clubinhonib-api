import {
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PdfLibreOfficeService } from './pdf-libreoffice.service';

describe('PdfLibreOfficeService (BE07 / BE10)', () => {
  it('converts DOCX to valid PDF and cleans up temporary directory', async () => {
    let capturedDir = '';
    const service = new PdfLibreOfficeService({
      maxConcurrent: 2,
      execFn: async (_file, args) => {
        const outdirIndex = args.indexOf('--outdir');
        capturedDir = args[outdirIndex + 1];
        await writeFile(
          join(capturedDir, 'lesson.pdf'),
          Buffer.from('%PDF-1.7\nmock pdf content'),
        );
      },
    });

    const result = await service.convertDocxToPdf(Buffer.from('mock-docx'));
    expect(result.subarray(0, 5).toString()).toBe('%PDF-');
    await expect(access(capturedDir)).rejects.toThrow();
  });

  it('throws UnprocessableEntityException when output lacks %PDF- header and cleans up directory', async () => {
    let capturedDir = '';
    const service = new PdfLibreOfficeService({
      execFn: async (_file, args) => {
        const outdirIndex = args.indexOf('--outdir');
        capturedDir = args[outdirIndex + 1];
        await writeFile(
          join(capturedDir, 'lesson.pdf'),
          Buffer.from('NOT-A-PDF'),
        );
      },
    });

    await expect(
      service.convertDocxToPdf(Buffer.from('mock-docx')),
    ).rejects.toThrow(UnprocessableEntityException);
    await expect(access(capturedDir)).rejects.toThrow();
  });

  it('throws ServiceUnavailableException when soffice fails and cleans up directory', async () => {
    let capturedDir = '';
    const service = new PdfLibreOfficeService({
      execFn: (_file, args) => {
        const outdirIndex = args.indexOf('--outdir');
        capturedDir = args[outdirIndex + 1];
        return Promise.reject(new Error('soffice process timed out'));
      },
    });

    await expect(
      service.convertDocxToPdf(Buffer.from('mock-docx')),
    ).rejects.toThrow(ServiceUnavailableException);
    await expect(access(capturedDir)).rejects.toThrow();
  });

  it('enforces bounded concurrency across simultaneous PDF conversions', async () => {
    let active = 0;
    let maxObserved = 0;
    const service = new PdfLibreOfficeService({
      maxConcurrent: 2,
      execFn: async (_file, args) => {
        active += 1;
        maxObserved = Math.max(maxObserved, active);
        await new Promise((resolve) => setTimeout(resolve, 25));
        const outdirIndex = args.indexOf('--outdir');
        const dir = args[outdirIndex + 1];
        await writeFile(join(dir, 'lesson.pdf'), Buffer.from('%PDF-1.4\nok'));
        active -= 1;
      },
    });

    const results = await Promise.all([
      service.convertDocxToPdf(Buffer.from('docx-1')),
      service.convertDocxToPdf(Buffer.from('docx-2')),
      service.convertDocxToPdf(Buffer.from('docx-3')),
      service.convertDocxToPdf(Buffer.from('docx-4')),
    ]);

    expect(results).toHaveLength(4);
    expect(maxObserved).toBeLessThanOrEqual(2);
  });
});
