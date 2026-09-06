import { HttpException, HttpStatus } from '@nestjs/common';

import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';

import { REDACTED_MARKER } from '../constants';
import {
  leadingErrorCode,
  messageToText,
  normalizeError,
  unknownToText,
} from './error-normalizer.utils';

describe('normalizeError', () => {
  it('AppException traz código e status', () => {
    const error = new AppNotFoundException(
      ErrorCode.CLUB_NOT_FOUND,
      'Clubinho não encontrado',
      { id: 1 },
    );
    expect(normalizeError(error)).toMatchObject({
      name: 'AppNotFoundException',
      message: 'Clubinho não encontrado',
      code: ErrorCode.CLUB_NOT_FOUND,
      statusCode: 404,
    });
    expect(normalizeError(error)).not.toHaveProperty('details');
  });

  it('HttpException traz status sem código', () => {
    expect(
      normalizeError(new HttpException('x', HttpStatus.BAD_GATEWAY)),
    ).toMatchObject({ code: null, statusCode: 502 });
  });

  it('Error comum: nome, mensagem redigida e code quando existir', () => {
    const error = Object.assign(
      new Error('ECONNRESET ao falar com joao@x.com'),
      { code: 'ECONNRESET' },
    );
    expect(normalizeError(error)).toMatchObject({
      name: 'Error',
      message: `ECONNRESET ao falar com ${REDACTED_MARKER}`,
      code: 'ECONNRESET',
      statusCode: null,
    });
  });

  it.each([
    ['texto', { name: null, message: 'texto', stack: null }],
    [
      { message: 'obj', name: 'Custom' },
      { name: 'Custom', message: 'obj' },
    ],
    [undefined, { message: null }],
    [42, { message: '42' }],
  ])('valor %p', (input, expected) => {
    expect(normalizeError(input)).toMatchObject(expected);
  });
});

describe('leadingErrorCode', () => {
  it('lê o código no início da mensagem do filtro', () => {
    expect(leadingErrorCode('[USER_2001] Usuário não encontrado')).toBe(
      'USER_2001',
    );
    expect(leadingErrorCode('sem código')).toBeNull();
  });
});

describe('messageToText / unknownToText', () => {
  it('nunca produz [object Object]', () => {
    expect(messageToText({ a: 1 })).toBe('{"a":1}');
    expect(messageToText(new Error('e'))).toBe('e');
    expect(messageToText(null)).toBe('');
    expect(unknownToText(Symbol('s'))).toBe('Symbol(s)');
    expect(unknownToText(() => 1)).toBe('[function]');
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(unknownToText(circular)).toBe('[unserializable]');
  });
});
