import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { IDEA_AI } from '../constants';

const run = promisify(execFile);

/**
 * Transforma as páginas de um PDF em PNG com o `pdftoppm` (poppler-utils).
 *
 * Só é usado para PDFs sem texto, cujo conteúdo é a própria imagem. Sem o
 * binário instalado o documento é mantido como enviado, nunca falha a
 * tentativa.
 */
@Injectable()
export class IdeaPdfRasterizerProvider {
  private readonly logger = new Logger(IdeaPdfRasterizerProvider.name);

  /** Páginas em PNG, na ordem; `null` quando o rasterizador não está disponível. */
  async toPngPages(pdf: Buffer, maxPages: number): Promise<Buffer[] | null> {
    const dir = await mkdtemp(join(tmpdir(), 'idea-pdf-'));
    try {
      await writeFile(join(dir, 'in.pdf'), pdf);
      await run(
        'pdftoppm',
        [
          '-png',
          '-r',
          String(IDEA_AI.scanDpi),
          '-l',
          String(maxPages),
          join(dir, 'in.pdf'),
          join(dir, 'page'),
        ],
        { timeout: IDEA_AI.requestTimeoutMs },
      );
      const files = (await readdir(dir))
        .filter((name) => name.startsWith('page') && name.endsWith('.png'))
        .sort();
      return await Promise.all(files.map((name) => readFile(join(dir, name))));
    } catch (error: unknown) {
      this.logger.warn(
        `Rasterização do PDF indisponível: ${
          error instanceof Error ? error.message : 'erro desconhecido'
        }`,
      );
      return null;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
