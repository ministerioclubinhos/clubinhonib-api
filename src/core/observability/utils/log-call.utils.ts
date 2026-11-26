import { STACK_FORMAT_PATTERN } from '../constants';
import { ParsedLogCall } from '../types';
import { messageToText } from './error-normalizer.utils';

/**
 * Separa `(message, ...optionalParams)` do jeito que o `ConsoleLogger` faz.
 *
 * O `Logger` do Nest acrescenta o `context` como último parâmetro; antes dele
 * pode vir um stack trace (reconhecido pelo formato). Repetir a regra aqui é o
 * que permite persistir stack e contexto separados sem mudar quem chama.
 */
export function parseLogCall(
  message: unknown,
  optionalParams: unknown[],
): ParsedLogCall {
  let context: string | null = null;
  let rest = optionalParams;

  const last = rest[rest.length - 1];
  if (
    rest.length > 0 &&
    typeof last === 'string' &&
    !STACK_FORMAT_PATTERN.test(last)
  ) {
    context = last;
    rest = rest.slice(0, -1);
  }

  let stack: string | null = null;
  const tail = rest[rest.length - 1];
  if (
    rest.length > 0 &&
    (tail === undefined ||
      (typeof tail === 'string' && STACK_FORMAT_PATTERN.test(tail)))
  ) {
    stack = typeof tail === 'string' ? tail : null;
    rest = rest.slice(0, -1);
  }

  const error =
    message instanceof Error
      ? message
      : (rest.find((param) => param instanceof Error) ?? null);
  const text = [
    messageToText(message),
    ...rest
      .filter((param) => !(param instanceof Error))
      .map((param) => messageToText(param)),
  ]
    .filter(Boolean)
    .join(' ');

  return {
    message: text,
    error,
    stack: stack ?? (error instanceof Error ? (error.stack ?? null) : null),
    context,
  };
}
