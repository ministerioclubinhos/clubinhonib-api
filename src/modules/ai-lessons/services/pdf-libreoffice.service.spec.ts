import {
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { access, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
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

  const okExec =
    (onRun?: () => void) =>
    async (_file: string, args: readonly string[]): Promise<void> => {
      onRun?.();
      const dir = args[args.indexOf('--outdir') + 1];
      await writeFile(join(dir, 'lesson.pdf'), Buffer.from('%PDF-1.4\nok'));
    };

  it('continua convertendo depois de falhas repetidas de mkdtemp (sem vazamento de slot)', async () => {
    const service = new PdfLibreOfficeService({
      maxConcurrent: 1,
      queueTimeoutMs: 100,
      execFn: okExec(),
      temporaryRoot: join(tmpdir(), 'clubinho-pdf-missing-root'),
    });
    for (let attempt = 0; attempt < 3; attempt++) {
      const started = Date.now();
      await expect(
        service.convertDocxToPdf(Buffer.from('docx')),
      ).rejects.toThrow(
        'Não foi possível converter o documento em PDF no momento.',
      );
      // A leaked slot would make the next call wait for the queue timeout.
      expect(Date.now() - started).toBeLessThan(90);
    }
  });

  it('não devolve ao cliente a linha de comando nem caminhos do servidor', async () => {
    const service = new PdfLibreOfficeService({
      execFn: () =>
        Promise.reject(
          new Error(
            'Command failed: soffice -env:UserInstallation=file:///tmp/clubinho-pdf-x/profile',
          ),
        ),
    });
    const error = await service
      .convertDocxToPdf(Buffer.from('docx'))
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as Error).message).not.toMatch(/soffice|tmp|profile/);
  });

  it('recusa imediatamente quando a fila de espera está cheia', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const service = new PdfLibreOfficeService({
      maxConcurrent: 1,
      maxQueued: 1,
      execFn: async (file, args) => {
        await gate;
        await okExec()(file, args);
      },
    });
    const running = service.convertDocxToPdf(Buffer.from('1'));
    const queued = service.convertDocxToPdf(Buffer.from('2'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    const started = Date.now();
    await expect(service.convertDocxToPdf(Buffer.from('3'))).rejects.toThrow(
      'Há muitas conversões de PDF em andamento.',
    );
    expect(Date.now() - started).toBeLessThan(50);
    release();
    await expect(Promise.all([running, queued])).resolves.toHaveLength(2);
  });

  it('reaproveita o PDF de uma versão imutável e compartilha conversões simultâneas', async () => {
    let runs = 0;
    const service = new PdfLibreOfficeService({
      execFn: okExec(() => runs++),
    });
    const [first, second] = await Promise.all([
      service.convertDocxToPdf(Buffer.from('docx'), 'version-1:abc'),
      service.convertDocxToPdf(Buffer.from('docx'), 'version-1:abc'),
    ]);
    expect(runs).toBe(1);
    expect(second).toBe(first);
    await service.convertDocxToPdf(Buffer.from('docx'), 'version-1:abc');
    expect(runs).toBe(1);
    await service.convertDocxToPdf(Buffer.from('docx'), 'version-2:def');
    expect(runs).toBe(2);
    // Without a key nothing is cached.
    await service.convertDocxToPdf(Buffer.from('docx'));
    await service.convertDocxToPdf(Buffer.from('docx'));
    expect(runs).toBe(4);
  });

  it('descarta os PDFs menos usados ao atingir o limite do cache e não guarda falhas', async () => {
    let runs = 0;
    let fail = true;
    const service = new PdfLibreOfficeService({
      cacheMaxEntries: 1,
      execFn: async (file, args) => {
        runs++;
        if (fail) throw new Error('boom');
        await okExec()(file, args);
      },
    });
    await expect(
      service.convertDocxToPdf(Buffer.from('docx'), 'a'),
    ).rejects.toThrow(ServiceUnavailableException);
    fail = false;
    await service.convertDocxToPdf(Buffer.from('docx'), 'a');
    await service.convertDocxToPdf(Buffer.from('docx'), 'b');
    await service.convertDocxToPdf(Buffer.from('docx'), 'a');
    expect(runs).toBe(4);
  });

  it('lê a concorrência do nome novo da variável e aceita o nome antigo', () => {
    const config = (values: Record<string, string>) =>
      ({ get: (key: string) => values[key] }) as unknown as ConfigService;
    const limitOf = (service: PdfLibreOfficeService): number =>
      (service as unknown as { maxConcurrent: number }).maxConcurrent;
    expect(
      limitOf(
        new PdfLibreOfficeService(
          undefined,
          config({
            PDF_CONVERSION_MAX_CONCURRENCY: '5',
            AI_LESSONS_MAX_PDF_CONVERSIONS: '3',
          }),
        ),
      ),
    ).toBe(5);
    expect(
      limitOf(
        new PdfLibreOfficeService(
          undefined,
          config({ AI_LESSONS_MAX_PDF_CONVERSIONS: '3' }),
        ),
      ),
    ).toBe(3);
    expect(limitOf(new PdfLibreOfficeService(undefined, config({})))).toBe(2);
  });

  it('apenas registra um aviso no boot quando o LibreOffice não está instalado', async () => {
    const service = new PdfLibreOfficeService({
      execFn: () => Promise.reject(new Error('spawn soffice ENOENT')),
    });
    const warn = jest
      .spyOn(
        (service as unknown as { logger: { warn: (m: string) => void } })
          .logger,
        'warn',
      )
      .mockImplementation(() => undefined);
    expect(() => service.onApplicationBootstrap()).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('LibreOffice (soffice) indisponível'),
    );
  });
});
