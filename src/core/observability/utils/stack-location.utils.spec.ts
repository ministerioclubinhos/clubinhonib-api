import {
  errorFingerprint,
  firstInternalFrame,
  parseStackFrames,
  relativizePath,
  sanitizeStack,
  sourceLocationOf,
} from './stack-location.utils';

const root = '/home/dev/app';
const stack = [
  'Error: boom para joao@x.com',
  `    at ClubsService.create (${root}/src/modules/clubs/services/create-clubs.service.ts:42:11)`,
  `    at ${root}/node_modules/@nestjs/core/router/router-execution-context.js:46:28`,
  '    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)',
  '    at /home/dev/outra-pasta/x.js:1:1',
].join('\n');

describe('relativizePath', () => {
  it('fica relativo à raiz e reduz caminho externo ao nome do arquivo', () => {
    expect(relativizePath(`${root}/src/a.ts`, root)).toBe('src/a.ts');
    expect(relativizePath('/home/dev/outra/x.js', root)).toBe('x.js');
    expect(relativizePath('node:internal/x', root)).toBe('node:internal/x');
    expect(relativizePath(`file://${root}/src/b.ts`, root)).toBe('src/b.ts');
  });
});

describe('parseStackFrames + localização', () => {
  const frames = parseStackFrames(stack, root);

  it('extrai função, arquivo relativo, linha e coluna', () => {
    expect(frames[0]).toEqual({
      functionName: 'ClubsService.create',
      file: 'src/modules/clubs/services/create-clubs.service.ts',
      line: 42,
      column: 11,
    });
    expect(frames).toHaveLength(4);
  });

  it('primeiro frame interno ignora node_modules e runtime', () => {
    expect(firstInternalFrame(frames)?.file).toBe(
      'src/modules/clubs/services/create-clubs.service.ts',
    );
    expect(sourceLocationOf(frames)).toEqual({
      sourceFile: 'src/modules/clubs/services/create-clubs.service.ts',
      sourceLine: 42,
      sourceColumn: 11,
    });
    expect(sourceLocationOf([])).toEqual({
      sourceFile: null,
      sourceLine: null,
      sourceColumn: null,
    });
  });
});

describe('sanitizeStack', () => {
  it('redige o cabeçalho, relativiza caminhos e limita frames', () => {
    const out = sanitizeStack(stack, root, 2) as string;
    expect(out.split('\n')).toHaveLength(3);
    expect(out).not.toContain('joao@x.com');
    expect(out).not.toContain('/home/dev');
    expect(out).toContain(
      'src/modules/clubs/services/create-clubs.service.ts:42:11',
    );
    expect(sanitizeStack(null)).toBeNull();
  });
});

describe('errorFingerprint', () => {
  it('é estável para o mesmo erro e muda com código ou local', () => {
    const frames = parseStackFrames(stack, root);
    const a = errorFingerprint('Error', 'INT_9001', frames);
    expect(a).toBe(errorFingerprint('Error', 'INT_9001', frames));
    expect(a).not.toBe(errorFingerprint('Error', 'INT_9002', frames));
    expect(a).toHaveLength(16);
    expect(errorFingerprint(null, null, [])).toBeNull();
  });
});
