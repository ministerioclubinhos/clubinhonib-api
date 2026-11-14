import { REDACTED_MARKER, TRUNCATION_MARKER } from '../constants';
import {
  isSensitiveKey,
  redactMetadata,
  redactText,
  redactValue,
  stripQueryString,
  truncate,
} from './redaction.utils';

describe('redactText', () => {
  it.each([
    [
      'Authorization: Bearer abc.def-ghi',
      `Authorization: Bearer ${REDACTED_MARKER}`,
    ],
    [
      'jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghij',
      `jwt ${REDACTED_MARKER}`,
    ],
    ['falha para joao.silva@example.com', `falha para ${REDACTED_MARKER}`],
    ['cpf 123.456.789-09 informado', `cpf ${REDACTED_MARKER} informado`],
    ['tel (11) 91234-5678 ok', `tel ${REDACTED_MARKER} ok`],
    [
      'GET https://api.x/y?access_token=1&e=2 falhou',
      'GET https://api.x/y falhou',
    ],
  ])('redige %s', (input, expected) => {
    expect(redactText(input)).toBe(expected);
  });

  it('trunca com marcador explícito', () => {
    const out = redactText('a'.repeat(3000), 100);
    expect(out).toHaveLength(100);
    expect(out.endsWith(TRUNCATION_MARKER)).toBe(true);
    expect(truncate('curto', 10)).toBe('curto');
  });

  it('stripQueryString mantém só o caminho', () => {
    expect(stripQueryString('/clubs?token=x')).toBe('/clubs');
    expect(stripQueryString('/clubs')).toBe('/clubs');
  });
});

describe('isSensitiveKey', () => {
  it.each([
    'Authorization',
    'PASSWORD',
    'refreshToken',
    'x-api-token',
    'cpf',
    'guardianName',
    'file.buffer'.split('.')[1],
  ])('%s é sensível', (key) => expect(isSensitiveKey(key)).toBe(true));
  it.each(['clubId', 'statusCode', 'outcome'])('%s não é', (key) =>
    expect(isSensitiveKey(key)).toBe(false),
  );
});

describe('redactValue', () => {
  it('redige chaves sensíveis em qualquer profundidade e limita a estrutura', () => {
    const circular: Record<string, unknown> = { level: 'error' };
    circular.self = circular;

    const out = redactValue(
      {
        password: 'x',
        nested: { token: 'y', ok: 1, deeper: { deepest: { tooDeep: true } } },
        list: Array.from({ length: 25 }, (_, i) => i),
        big: 123n,
        sym: Symbol('s'),
        fn: () => 1,
        when: new Date('2026-09-05T00:00:00Z'),
        buf: Buffer.from('abc'),
        err: new Error('boom joao@x.com'),
        circular,
        nan: Number.NaN,
      },
      { maxDepth: 3, maxKeys: 20, maxArray: 20, maxStringLength: 100 },
    ) as Record<string, unknown>;

    expect(out.password).toBe(REDACTED_MARKER);
    expect(out.nested).toEqual({
      token: REDACTED_MARKER,
      ok: 1,
      deeper: { deepest: '[depth-limit]' },
    });
    expect((out.list as unknown[]).length).toBe(21);
    expect((out.list as unknown[])[20]).toBe(TRUNCATION_MARKER);
    expect(out.big).toBe('123n');
    expect(out.sym).toBe('[symbol]');
    expect(out.fn).toBe('[function]');
    expect(out.when).toBe('2026-09-05T00:00:00.000Z');
    expect(out.buf).toBe('[buffer:3]');
    expect(out.err).toEqual({
      name: 'Error',
      message: `boom ${REDACTED_MARKER}`,
    });
    expect((out.circular as Record<string, unknown>).self).toBe('[circular]');
    expect(out.nan).toBe('NaN');
  });

  it('limita a quantidade de chaves', () => {
    const many = Object.fromEntries(
      Array.from({ length: 30 }, (_, i) => [`k${i}`, i]),
    );
    const out = redactValue(many, {
      maxDepth: 2,
      maxKeys: 5,
      maxArray: 5,
      maxStringLength: 10,
    }) as Record<string, unknown>;
    expect(Object.keys(out)).toHaveLength(6);
    expect(out[TRUNCATION_MARKER]).toBe(true);
  });
});

describe('redactMetadata', () => {
  it('só deixa passar chaves allowlisted, ainda redigidas', () => {
    expect(
      redactMetadata({
        operation: 'upload',
        body: { a: 1 },
        email: 'x@y.com',
        count: 2,
        statusCode: 500,
      }),
    ).toEqual({ operation: 'upload', count: 2, statusCode: 500 });
    expect(redactMetadata({ body: 1 })).toBeNull();
    expect(redactMetadata(null)).toBeNull();
  });
});
