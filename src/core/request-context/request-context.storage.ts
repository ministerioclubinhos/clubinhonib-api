import { AsyncLocalStorage } from 'node:async_hooks';

import { RequestExecutionContext } from './types';

/**
 * A única instância de `AsyncLocalStorage` da aplicação.
 *
 * Fica fora do container para o middleware funcional, o logger e os hooks
 * de processo enxergarem o mesmo contexto mesmo antes de a injeção existir.
 */
export const requestContextStorage =
  new AsyncLocalStorage<RequestExecutionContext>();
