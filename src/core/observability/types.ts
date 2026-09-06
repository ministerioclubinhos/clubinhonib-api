import { LogSourceType } from 'src/shared/providers/log-storage/enums';
import { JsonObject, LogRecord } from 'src/shared/providers/log-storage/types';

import { LogLevel } from './enums';

/** Item técnico como vai para o storage. */
export interface ObservabilityRecord extends LogRecord {
  level: LogLevel;
  context: string;
  moduleName: string;
  operation: string | null;
  message: string;
  errorName: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  stack: string | null;
  sourceFile: string | null;
  sourceLine: number | null;
  sourceColumn: number | null;
  errorFingerprint: string | null;
  httpMethod: string | null;
  routeTemplate: string | null;
  statusCode: number | null;
  durationMs: number | null;
  providerName: string | null;
  jobName: string | null;
  metadata: JsonObject | null;
}

/** O que quem reporta um problema técnico informa. */
export interface TechnicalLogInput {
  level: LogLevel;
  context: string | null;
  message: string;
  /** O erro bruto; é normalizado e redigido aqui, nunca persistido inteiro. */
  error?: unknown;
  /** Stack já separada, quando o chamador só tem o texto (logger Nest). */
  stack?: string | null;
  operation?: string | null;
  providerName?: string | null;
  metadata?: Record<string, unknown> | null;
  /** Fronteira, quando não há contexto de request para informar. */
  sourceType?: LogSourceType;
}

export interface NormalizedError {
  name: string | null;
  message: string | null;
  code: string | null;
  statusCode: number | null;
  stack: string | null;
}

export interface StackFrame {
  functionName: string | null;
  file: string;
  line: number;
  column: number;
}

export interface SourceLocation {
  sourceFile: string | null;
  sourceLine: number | null;
  sourceColumn: number | null;
}

export interface RedactionLimits {
  maxDepth: number;
  maxKeys: number;
  maxArray: number;
  maxStringLength: number;
}

/** Como o logger Nest separa os parâmetros de uma chamada. */
export interface ParsedLogCall {
  message: string;
  error: unknown;
  stack: string | null;
  context: string | null;
}
