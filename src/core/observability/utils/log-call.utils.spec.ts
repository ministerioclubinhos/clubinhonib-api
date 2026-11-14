import { parseLogCall } from './log-call.utils';

const stack = 'Error: x\n    at fn (/a/b.ts:1:2)';

describe('parseLogCall', () => {
  it('separa mensagem, stack e contexto como o Logger do Nest passa', () => {
    expect(parseLogCall('falhou', [stack, 'ClubsService'])).toEqual({
      message: 'falhou',
      error: null,
      stack,
      context: 'ClubsService',
    });
  });

  it('stack indefinida (logger.error(msg, undefined, ctx))', () => {
    expect(parseLogCall('falhou', [undefined, 'Ctx'])).toMatchObject({
      message: 'falhou',
      stack: null,
      context: 'Ctx',
    });
  });

  it('só contexto', () => {
    expect(parseLogCall('falhou', ['Ctx'])).toMatchObject({
      message: 'falhou',
      stack: null,
      context: 'Ctx',
    });
  });

  it('Error como mensagem traz o próprio erro e a stack dele', () => {
    const error = new Error('boom');
    const call = parseLogCall(error, ['Ctx']);
    expect(call.error).toBe(error);
    expect(call.stack).toBe(error.stack);
    expect(call.message).toBe('boom');
  });

  it('parâmetros extras viram texto seguro na mensagem', () => {
    expect(parseLogCall('a', [{ b: 1 }, 'Ctx']).message).toBe('a {"b":1}');
  });
});
