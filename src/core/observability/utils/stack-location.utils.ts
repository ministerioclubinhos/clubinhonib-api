import { createHash } from 'node:crypto';
import { isAbsolute, relative, sep } from 'node:path';

import {
  FINGERPRINT_FRAMES,
  FINGERPRINT_LENGTH,
  STACK_MAX_FRAMES,
  STACK_MAX_LENGTH,
} from '../constants';
import { SourceLocation, StackFrame } from '../types';
import { redactText, truncate } from './redaction.utils';

const FRAME_PATTERN = /^\s*at\s+(?:(.+?)\s+\()?(?:(.+?):(\d+):(\d+))\)?\s*$/;

/**
 * Torna um caminho relativo à raiz do processo.
 *
 * Caminho de fora da raiz fica só com o nome do arquivo: um `/home/<usuário>`
 * no log identifica a máquina e a pessoa.
 */
export function relativizePath(
  file: string,
  root: string = process.cwd(),
): string {
  const withoutScheme = file.replace(/^file:\/\//, '');
  if (withoutScheme.startsWith('node:')) return withoutScheme;
  if (!isAbsolute(withoutScheme)) return withoutScheme.split(sep).join('/');
  const rel = relative(root, withoutScheme);
  if (!rel || rel.startsWith('..')) {
    return withoutScheme.split(sep).pop() ?? withoutScheme;
  }
  return rel.split(sep).join('/');
}

export function parseStackFrames(
  stack: string | null | undefined,
  root: string = process.cwd(),
): StackFrame[] {
  if (!stack) return [];
  const frames: StackFrame[] = [];
  for (const line of stack.split('\n')) {
    const match = FRAME_PATTERN.exec(line);
    if (!match) continue;
    frames.push({
      functionName: match[1] ?? null,
      file: relativizePath(match[2], root),
      line: Number(match[3]),
      column: Number(match[4]),
    });
  }
  return frames;
}

/** Primeiro frame do código da aplicação, fora de `node_modules` e do runtime. */
export function firstInternalFrame(frames: StackFrame[]): StackFrame | null {
  return (
    frames.find(
      (frame) =>
        !frame.file.includes('node_modules') && !frame.file.startsWith('node:'),
    ) ?? null
  );
}

export function sourceLocationOf(frames: StackFrame[]): SourceLocation {
  const frame = firstInternalFrame(frames);
  return {
    sourceFile: frame?.file ?? null,
    sourceLine: frame?.line ?? null,
    sourceColumn: frame?.column ?? null,
  };
}

/**
 * Stack limitada, com caminhos relativos e cabeçalho redigido.
 *
 * A primeira linha é a mensagem do erro e pode trazer dado de vendor; os
 * frames são reescritos a partir do que foi parseado, sem o caminho absoluto.
 */
export function sanitizeStack(
  stack: string | null | undefined,
  root: string = process.cwd(),
  maxFrames: number = STACK_MAX_FRAMES,
): string | null {
  if (!stack) return null;
  const [header] = stack.split('\n');
  const frames = parseStackFrames(stack, root).slice(0, maxFrames);
  const lines = [
    redactText(header ?? ''),
    ...frames.map(
      (frame) =>
        `    at ${frame.functionName ? `${frame.functionName} (` : ''}${frame.file}:${frame.line}:${frame.column}${frame.functionName ? ')' : ''}`,
    ),
  ];
  return truncate(lines.join('\n'), STACK_MAX_LENGTH);
}

/** Hash estável de classe, código e primeiros frames internos. */
export function errorFingerprint(
  name: string | null,
  code: string | null,
  frames: StackFrame[],
): string | null {
  const internal = frames
    .filter((frame) => !frame.file.includes('node_modules'))
    .slice(0, FINGERPRINT_FRAMES)
    .map((frame) => `${frame.file}:${frame.line}`);
  if (!name && !code && internal.length === 0) return null;
  return createHash('sha256')
    .update([name ?? '', code ?? '', ...internal].join('|'))
    .digest('hex')
    .slice(0, FINGERPRINT_LENGTH);
}
