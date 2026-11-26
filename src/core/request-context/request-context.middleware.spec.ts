import { Request, Response } from 'express';

import { REQUEST_ID_HEADER } from './constants';
import { RequestContextMiddleware } from './request-context.middleware';
import { requestContextStorage } from './request-context.storage';

describe('RequestContextMiddleware', () => {
  it('gera um UUID no servidor, devolve no cabeçalho e ignora o do cliente', () => {
    const middleware = new RequestContextMiddleware();
    const headers: Record<string, string> = {};
    const response = {
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
    } as unknown as Response;
    let inside: string | null = null;

    middleware.use(
      {
        method: 'GET',
        headers: { 'x-request-id': 'do-cliente' },
      } as unknown as Request,
      response,
      () => {
        inside = requestContextStorage.getStore()?.requestId ?? null;
      },
    );

    expect(inside).toMatch(/^[0-9a-f-]{36}$/);
    expect(inside).not.toBe('do-cliente');
    expect(headers[REQUEST_ID_HEADER]).toBe(inside);
    expect(requestContextStorage.getStore()).toBeUndefined();
  });
});
