import {
  AppException,
  AppValidationException,
  ErrorCode,
} from 'src/shared/exceptions';
import { LogStorageKind } from 'src/shared/providers/log-storage/enums';

import { assertQueryable, pickFilters, validateRange } from './utils';

describe('validateRange', () => {
  it('aceita intervalo válido dentro do limite', () => {
    const range = validateRange('2026-09-01T00:00:00Z', '2026-09-05T00:00:00Z');
    expect(range.from.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-09-05T00:00:00.000Z');
  });

  it.each([
    ['x', '2026-09-05T00:00:00Z'],
    ['2026-09-05T00:00:00Z', '2026-09-05T00:00:00Z'],
    ['2026-09-06T00:00:00Z', '2026-09-05T00:00:00Z'],
    ['2026-08-01T00:00:00Z', '2026-09-05T00:00:00Z'],
  ])('recusa %s..%s', (from, to) => {
    expect(() => validateRange(from, to)).toThrow(AppValidationException);
  });
});

describe('pickFilters', () => {
  it('só campos allowlisted e preenchidos', () => {
    expect(
      pickFilters(
        {
          level: 'error',
          errorCode: ' ',
          sourceType: undefined,
          requestId: 'x',
        },
        ['level', 'errorCode', 'sourceType'],
      ),
    ).toEqual({ level: 'error' });
  });
});

describe('assertQueryable', () => {
  it('deixa passar storage consultável e recusa file com 409 LOG_9101', () => {
    expect(() =>
      assertQueryable({ queryable: true }, LogStorageKind.DynamoDb),
    ).not.toThrow();
    try {
      assertQueryable({ queryable: false }, LogStorageKind.File);
      throw new Error('deveria ter lançado');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).code).toBe(
        ErrorCode.LOG_QUERY_UNAVAILABLE,
      );
      expect((error as AppException).getStatus()).toBe(409);
    }
  });
});
