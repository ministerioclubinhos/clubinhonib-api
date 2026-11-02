import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';

const auditorPath = path.resolve(
  __dirname,
  '../../../../scripts/s3/audit-orphans.js',
);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const auditor = require(auditorPath) as {
  extractKey: (url: string, bucket: string) => string | null;
  isPotentialStudioUploadKey: (key: string) => boolean;
  loadReferencedKeys: (
    connection: {
      execute: (sql: string) => Promise<[unknown[]]>;
    },
    bucket: string,
  ) => Promise<{
    byKey: Map<string, Array<{ source: string; id: string }>>;
    lessonVersionsCount: number;
    activeStagesCount: number;
  }>;
};

describe('S3 orphan auditor (BE02 — A06 protection)', () => {
  it('inclui referências de media_items, lesson_versions (atuais e históricas) e lesson_stages em geração', async () => {
    const queries: string[] = [];
    const connection = {
      execute: jest.fn((sql: string): Promise<[unknown[]]> => {
        queries.push(sql);
        if (sql.includes('FROM media_items')) {
          return Promise.resolve([
            [
              {
                id: 'media-1',
                url: 'https://audit-bucket.s3.amazonaws.com/audit/uploads/media-doc.pdf',
                targetType: 'WEEK_MATERIAL',
                targetId: 'page-1',
              },
            ],
          ]);
        }
        if (sql.includes('FROM lesson_versions')) {
          return Promise.resolve([
            [
              {
                id: 'version-old',
                stageId: 'stage-1',
                docxS3Key: 'audit/uploads/old-version.docx',
                pdfS3Key: null,
                structuredDataJson: JSON.stringify({
                  assets: [
                    {
                      id: 'visual-01',
                      url: 'https://audit-bucket.s3.amazonaws.com/audit/uploads/lesson-1-LESSON_VISUALS-visual-01.png',
                    },
                  ],
                }),
                tiptapAstJson: JSON.stringify({ type: 'doc', content: [] }),
              },
              {
                id: 'version-current',
                stageId: 'stage-1',
                docxS3Key: null,
                pdfS3Key:
                  'https://s3.us-east-1.amazonaws.com/audit-bucket/audit/uploads/current-version.pdf',
                structuredDataJson: JSON.stringify({
                  printableAssets: [
                    {
                      id: 'card-01',
                      url: 'https://audit-bucket.s3.amazonaws.com/audit/uploads/lesson-1-VERSE_VISUALS-card-01.png',
                    },
                  ],
                }),
                tiptapAstJson: JSON.stringify({ type: 'doc', content: [] }),
              },
            ],
          ]);
        }
        if (sql.includes('FROM lesson_stages')) {
          return Promise.resolve([
            [
              {
                id: 'stage-gen',
                lessonId: 'lesson-inflight',
                type: 'LESSON_VISUALS',
                status: 'GENERATING',
                generationRequestJson: JSON.stringify({
                  checkpointUrls: [
                    'https://audit-bucket.s3.amazonaws.com/audit/uploads/inflight-checkpoint.png',
                  ],
                }),
              },
            ],
          ]);
        }
        return Promise.resolve([[]]);
      }),
    };

    const result = await auditor.loadReferencedKeys(connection, 'audit-bucket');
    expect(queries.some((q) => q.includes('FROM media_items'))).toBe(true);
    expect(queries.some((q) => q.includes('FROM lesson_versions'))).toBe(true);
    expect(queries.some((q) => q.includes('FROM lesson_stages'))).toBe(true);
    expect(result.byKey.has('audit/uploads/media-doc.pdf')).toBe(true);
    expect(result.byKey.has('audit/uploads/old-version.docx')).toBe(true);
    expect(result.byKey.has('audit/uploads/current-version.pdf')).toBe(true);
    expect(
      result.byKey.has('audit/uploads/lesson-1-LESSON_VISUALS-visual-01.png'),
    ).toBe(true);
    expect(
      result.byKey.has('audit/uploads/lesson-1-VERSE_VISUALS-card-01.png'),
    ).toBe(true);
    expect(result.byKey.has('audit/uploads/inflight-checkpoint.png')).toBe(
      true,
    );
  });

  it('falha de modo fechado (fail-closed) quando qualquer tabela falha ou contém JSON corrompido', async () => {
    const failingConnection = {
      execute: jest.fn((sql: string): Promise<[unknown[]]> => {
        if (sql.includes('FROM lesson_versions')) {
          return Promise.reject(
            new Error('Table lesson_versions is unavailable'),
          );
        }
        return Promise.resolve([[]]);
      }),
    };
    await expect(
      auditor.loadReferencedKeys(failingConnection, 'audit-bucket'),
    ).rejects.toThrow('Table lesson_versions is unavailable');

    const corruptJsonConnection = {
      execute: jest.fn((sql: string): Promise<[unknown[]]> => {
        if (sql.includes('FROM lesson_versions')) {
          return Promise.resolve([
            [
              {
                id: 'v-bad',
                stageId: 's-1',
                structuredDataJson: '{not-valid-json',
                tiptapAstJson: '{}',
              },
            ],
          ]);
        }
        return Promise.resolve([[]]);
      }),
    };
    await expect(
      auditor.loadReferencedKeys(corruptJsonConnection, 'audit-bucket'),
    ).rejects.toThrow(/JSON inválido/);
  });

  it('não apaga imagem do Studio quando executado com --delete --confirm em ambiente sintético', async () => {
    const auditorSource = fs.readFileSync(auditorPath, 'utf8');
    const studioKey = 'audit/uploads/audit-lesson-LESSON_VISUALS-visual-01.png';
    const unrelatedOrphanKey = 'audit/uploads/legacy-unreferenced-photo.png';
    const deletedKeys: string[] = [];
    const executedQueries: string[] = [];

    let completed!: () => void;
    let failed!: (err: Error) => void;
    const done = new Promise<void>((resolve, reject) => {
      completed = resolve;
      failed = reject;
    });

    class ListObjectsV2Command {
      constructor(public readonly input: Record<string, unknown>) {}
    }
    class DeleteObjectCommand {
      constructor(public readonly input: { Key: string }) {}
    }
    class S3Client {
      send(command: unknown): Promise<Record<string, unknown>> {
        if (command instanceof ListObjectsV2Command) {
          return Promise.resolve({
            Contents: [
              {
                Key: studioKey,
                Size: 100,
                LastModified: new Date('2026-01-01'),
              },
              {
                Key: unrelatedOrphanKey,
                Size: 200,
                LastModified: new Date('2026-01-01'),
              },
            ],
            IsTruncated: false,
          });
        }
        if (command instanceof DeleteObjectCommand) {
          deletedKeys.push(command.input.Key);
          return Promise.resolve({});
        }
        return Promise.reject(new Error('Unexpected S3 command'));
      }
    }

    vm.runInNewContext(auditorSource, {
      require(name: string) {
        if (name === 'node:fs') return { existsSync: () => false };
        if (name === 'node:path') return path;
        if (name === 'mysql2/promise') {
          return {
            createConnection: () =>
              Promise.resolve({
                execute: (sql: string) => {
                  executedQueries.push(sql);
                  return Promise.resolve([[]]);
                },
                end: () => {
                  completed();
                  return Promise.resolve();
                },
              }),
          };
        }
        if (name === '@aws-sdk/client-s3') {
          return { S3Client, ListObjectsV2Command, DeleteObjectCommand };
        }
        throw new Error(`Unexpected module: ${name}`);
      },
      process: {
        env: {
          AWS_S3_BUCKET_NAME: 'audit-bucket',
          AWS_REGION: 'audit-region',
          ENVIRONMENT: 'audit',
        },
        argv: ['node', 'audit', '--delete', '--confirm'],
        cwd: () => process.cwd(),
        exit: (code: number) => failed(new Error(`Exited with ${code}`)),
      },
      console: {
        log: () => undefined,
        error: (...args: unknown[]) => failed(new Error(args.join(' '))),
      },
    });

    await done;
    expect(
      executedQueries.some((q) => q.includes('FROM lesson_versions')),
    ).toBe(true);
    expect(deletedKeys).not.toContain(studioKey);
    expect(deletedKeys).toContain(unrelatedOrphanKey);
  });
});
