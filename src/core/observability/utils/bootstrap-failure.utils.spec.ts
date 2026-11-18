import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { LogSourceType } from 'src/shared/providers/log-storage/enums';

import { writeBootstrapFailure } from './bootstrap-failure.utils';

describe('writeBootstrapFailure', () => {
  let dir: string;

  let stderr: jest.SpyInstance;

  beforeEach(() => {
    dir = mkdtempSync(join(process.cwd(), 'tmp-boot-'));
    stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('grava uma linha JSONL na pasta local e sinaliza em stderr, sem lançar', () => {
    const now = new Date('2026-09-05T03:00:00Z');
    writeBootstrapFailure(
      new Error('porta ocupada para joao@x.com'),
      { OBS_LOCAL_DIR: relative(process.cwd(), dir), ENVIRONMENT: 'local' },
      now,
    );

    const files = readdirSync(dir);
    expect(files).toEqual([`2026-09-05.${process.pid}.jsonl`]);
    const record = JSON.parse(
      readFileSync(join(dir, files[0]), 'utf8').trim(),
    ) as Record<string, unknown>;
    expect(record).toMatchObject({
      level: 'fatal',
      sourceType: LogSourceType.Bootstrap,
      environment: 'local',
    });
    expect(record.errorMessage).not.toContain('joao@x.com');
    expect(stderr).toHaveBeenCalled();
  });

  it('com storage dynamodb só sinaliza em stderr', () => {
    writeBootstrapFailure(new Error('x'), {
      OBS_STORAGE: 'dynamodb',
      OBS_LOCAL_DIR: relative(process.cwd(), dir),
    });
    expect(readdirSync(dir)).toEqual([]);
    expect(stderr).toHaveBeenCalled();
  });

  it('pasta inválida não lança', () => {
    expect(() =>
      writeBootstrapFailure(new Error('x'), { OBS_LOCAL_DIR: tmpdir() }),
    ).not.toThrow();
  });
});
