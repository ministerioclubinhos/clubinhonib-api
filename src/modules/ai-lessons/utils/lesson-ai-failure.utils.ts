import { BadGatewayException, HttpException, HttpStatus } from '@nestjs/common';
import { AppException, ErrorCode } from 'src/shared/exceptions';
import { AiQueueException } from 'src/shared/providers/ai-queue/ai-queue.exception';
import { AiQueueFailure } from 'src/shared/providers/ai-queue/enums';
import { LESSON_NARRATIVE_INCOMPLETE_PREFIX } from '../constants/lesson-editorial.constants';
import {
  LESSON_STAGE_FAILURE_MESSAGE_MAX_LENGTH,
  LESSON_STAGE_ITEM_NAMES,
} from '../constants/lesson-workflow.constants';
import { LESSON_STAGE_ORDER, LessonStageType } from '../enums/lesson.enums';
import { LessonFailureCode } from '../enums/lesson-failure-code.enum';
import { LessonLlmProvider } from '../providers/lesson-llm.types';
import type {
  LessonAiFailure,
  LessonAiFailureContext,
  LessonJsonObject,
} from '../types/lesson-generation.types';
import { lessonString } from '../utils';
import { LessonGeneratedImageInvalidError } from './lesson-upload-image.utils';
import { lessonAsObject } from './lesson-workflow.utils';

const PROVIDER_LABELS: Record<LessonLlmProvider, string> = {
  [LessonLlmProvider.OPENAI]: 'OpenAI',
  [LessonLlmProvider.GEMINI]: 'Gemini',
};

/** Raised when a stage was resumed more often than the policy allows. */
export class LessonGenerationAttemptsExhaustedError extends Error {
  constructor() {
    super(
      'a geração foi interrompida repetidas vezes e não será retomada automaticamente. A versão anterior foi preservada; gere este item novamente.',
    );
    this.name = 'LessonGenerationAttemptsExhaustedError';
  }
}

/** Raised inside an attempt that lost its lease or is shutting down. */
export class LessonGenerationAbortedError extends Error {
  constructor() {
    super('Tentativa de geração interrompida.');
    this.name = 'LessonGenerationAbortedError';
  }
}

function providerLabel(
  raw: string,
  context: LessonAiFailureContext,
): string | undefined {
  const key = context.provider?.trim().toLowerCase();
  if (key === String(LessonLlmProvider.OPENAI))
    return PROVIDER_LABELS[LessonLlmProvider.OPENAI];
  if (key === String(LessonLlmProvider.GEMINI))
    return PROVIDER_LABELS[LessonLlmProvider.GEMINI];
  // Legacy requests carry no provider snapshot: fall back to the message.
  if (/gemini/i.test(raw)) return PROVIDER_LABELS[LessonLlmProvider.GEMINI];
  if (/openai/i.test(raw)) return PROVIDER_LABELS[LessonLlmProvider.OPENAI];
  return undefined;
}

/**
 * Translates a generation error into the failure code and the Portuguese
 * message stored on the stage. Never includes prompts, keys or raw payloads.
 */
export function describeAiFailure(
  type: LessonStageType,
  error: unknown,
  context: LessonAiFailureContext = {},
): LessonAiFailure {
  const raw = error instanceof Error ? error.message : String(error);
  const provider = providerLabel(raw, context);
  const stageOrder = context.stageOrder ?? LESSON_STAGE_ORDER;
  const position = stageOrder.indexOf(type);
  const itemLabel = `${position >= 0 ? `${position + 1}. ` : ''}${LESSON_STAGE_ITEM_NAMES[type]}`;
  const prefix = `Falha no item ${itemLabel}${provider ? ` usando ${provider}` : ''}: `;
  const result = (
    code: LessonFailureCode,
    detail: string,
  ): LessonAiFailure => ({
    code,
    message: `${prefix}${detail}`.slice(
      0,
      LESSON_STAGE_FAILURE_MESSAGE_MAX_LENGTH,
    ),
  });

  if (
    raw.startsWith(LESSON_NARRATIVE_INCOMPLETE_PREFIX) ||
    /resposta incompleta da OpenAI/i.test(raw)
  )
    return result(
      LessonFailureCode.AI_INCOMPLETE_RESPONSE,
      'a resposta foi interrompida ou a narrativa contém sinais de incompletude. A versão anterior foi preservada; gere novamente para obter o conteúdo completo.',
    );

  if (error instanceof AiQueueException) {
    if (error.reason === AiQueueFailure.CREDENTIAL_MISSING)
      return result(
        LessonFailureCode.AI_CONFIGURATION_MISSING,
        'a chave de API não está configurada. Salve a chave do provedor selecionado na página Configuração de provedores de IA e gere este item novamente.',
      );
    if (
      error.reason === AiQueueFailure.EXPIRED ||
      error.reason === AiQueueFailure.RESULT_EXPIRED
    )
      return result(LessonFailureCode.AI_QUEUE_TIMEOUT, raw);
    return result(LessonFailureCode.AI_QUEUE_UNAVAILABLE, raw);
  }

  // A provider failure carries its own code (timeout, quota…) in the message;
  // only a bare gateway error means the provider returned an unusable file.
  if (error instanceof BadGatewayException && !hasUpstreamErrorPayload(raw))
    return result(
      LessonFailureCode.AI_IMAGE_INVALID,
      `${raw} A versão anterior foi preservada; gere novamente.`,
    );

  if (error instanceof LessonGenerationAttemptsExhaustedError)
    return result(LessonFailureCode.GENERATION_ATTEMPTS_EXHAUSTED, raw);

  if (error instanceof LessonGeneratedImageInvalidError)
    return result(
      LessonFailureCode.AI_IMAGE_INVALID,
      `${raw} A versão anterior foi preservada; gere novamente.`,
    );

  if (
    error instanceof AppException &&
    error.getCode() === ErrorCode.LESSON_DEPENDENCY_INCOMPLETE
  )
    return result(LessonFailureCode.UPSTREAM_CHANGED, raw);

  if (
    error instanceof HttpException &&
    error.getStatus() === Number(HttpStatus.CONFLICT)
  )
    return result(LessonFailureCode.AI_CONTENT_INVALID, raw);

  if (/API_KEY não configurada/i.test(raw))
    return result(
      LessonFailureCode.AI_CONFIGURATION_MISSING,
      'a chave de API não está configurada. Salve a chave do provedor selecionado na página Configuração de provedores de IA e gere este item novamente.',
    );

  if (/\b(ECONNABORTED|ETIMEDOUT)\b|timeout of \d+ ?ms exceeded/i.test(raw))
    return result(
      LessonFailureCode.AI_TIMEOUT,
      'o provedor demorou além do limite para responder. Tente novamente.',
    );

  if (/\b(ECONNRESET|EPIPE|EAI_AGAIN)\b/i.test(raw))
    return result(
      LessonFailureCode.AI_CONNECTION_INTERRUPTED,
      'a conexão com o provedor caiu durante a geração. Uma nova tentativa da imagem também falhou. Tente novamente em alguns minutos; a versão salva anteriormente foi preservada.',
    );

  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}');
  let upstreamError: LessonJsonObject = {};
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    try {
      const payload = JSON.parse(
        raw.slice(jsonStart, jsonEnd + 1),
      ) as LessonJsonObject;
      upstreamError = lessonAsObject(payload.error);
    } catch {
      upstreamError = {};
    }
  }
  const upstreamCode = lessonString(upstreamError.code).toLowerCase();
  const upstreamType = lessonString(upstreamError.type).toLowerCase();
  const upstreamStatus = lessonString(upstreamError.status).toLowerCase();
  const code = /^\d+$/.test(upstreamCode)
    ? upstreamStatus
    : upstreamCode || upstreamStatus;

  if (code === 'max_tokens')
    return result(
      LessonFailureCode.AI_INCOMPLETE_RESPONSE,
      'o provedor interrompeu a resposta ao atingir o limite de saída. A versão anterior foi preservada; gere novamente ou revise o modelo configurado.',
    );

  if (provider === 'OpenAI' && code === 'billing_not_active')
    return result(
      LessonFailureCode.AI_BILLING_INACTIVE,
      'o faturamento da conta não está ativo. Revise o faturamento da OpenAI ou selecione outro provedor nas configurações de IA.',
    );
  if (provider === 'OpenAI' && code === 'credit_balance_exhausted')
    return result(
      LessonFailureCode.AI_CREDITS_EXHAUSTED,
      'os créditos da conta acabaram. Adicione créditos ou ajuste o faturamento do provedor e tente novamente.',
    );
  if (
    provider === 'OpenAI' &&
    [
      'organization_spend_limit_exceeded',
      'project_spend_limit_exceeded',
      'organization_usage_limit_exceeded',
    ].includes(code)
  )
    return result(
      LessonFailureCode.AI_USAGE_LIMIT_EXCEEDED,
      'o limite de gastos ou de uso da conta foi atingido. Revise os limites da organização ou do projeto antes de tentar novamente.',
    );
  if (provider === 'OpenAI' && upstreamType === 'insufficient_quota')
    return result(
      LessonFailureCode.AI_QUOTA_UNAVAILABLE,
      'a OpenAI informou uma falha de faturamento, gastos ou cota, mas não enviou um código mais específico. Revise créditos e limites da conta.',
    );
  if (
    (provider === 'OpenAI' &&
      ['rate_limit_exceeded', 'slow_down'].includes(code)) ||
    (provider === 'Gemini' &&
      [
        'rate_limit_exceeded',
        'quota_exceeded',
        'too_many_requests',
        'resource_exhausted',
      ].includes(code))
  )
    return result(
      LessonFailureCode.AI_RATE_LIMITED,
      'o limite de uso ou de solicitações foi atingido. Aguarde a renovação da cota ou aumente o limite da conta.',
    );
  if (provider === 'Gemini' && code === 'payment_required')
    return result(
      LessonFailureCode.AI_CREDITS_EXHAUSTED,
      'o saldo de créditos pré-pagos acabou. Adicione créditos ou ative a recarga automática antes de tentar novamente.',
    );
  if (
    (provider === 'OpenAI' && upstreamType === 'authentication_error') ||
    (provider === 'Gemini' && code === 'authentication')
  )
    return result(
      LessonFailureCode.AI_AUTHENTICATION_FAILED,
      'a chave de API está ausente, inválida ou foi revogada. Revise a configuração do provedor.',
    );
  if (code === 'permission_denied')
    return result(
      LessonFailureCode.AI_PERMISSION_DENIED,
      'a conta não tem permissão para usar o modelo ou recurso solicitado.',
    );
  if (code === 'model_not_found' || code === 'not_found')
    return result(
      LessonFailureCode.AI_MODEL_NOT_FOUND,
      'o modelo configurado não existe ou não está disponível para esta conta.',
    );
  if (code === 'deadline_exceeded')
    return result(
      LessonFailureCode.AI_TIMEOUT,
      'o provedor demorou além do limite para responder. Tente novamente.',
    );
  if (
    [
      'moderation_blocked',
      'safety',
      'recitation',
      'language',
      'prohibited_content',
      'spii',
      'blocklist',
      'image_safety',
      'image_prohibited_content',
      'image_recitation',
      'image_other',
      'content_blocked',
    ].includes(code)
  )
    return result(
      LessonFailureCode.AI_CONTENT_BLOCKED,
      'o provedor bloqueou o conteúdo pelas regras de segurança. Revise as instruções e tente novamente.',
    );
  if (
    ['server_is_overloaded', 'service_unavailable', 'api_error'].includes(code)
  )
    return result(
      LessonFailureCode.AI_PROVIDER_UNAVAILABLE,
      'o serviço está temporariamente indisponível ou houve falha de conexão. Tente novamente em alguns minutos.',
    );
  if (
    [
      'invalid_request',
      'failed_precondition',
      'out_of_range',
      'parameter_unknown',
    ].includes(code)
  )
    return result(
      LessonFailureCode.AI_INVALID_REQUEST,
      'o provedor rejeitou parâmetros ou pré-requisitos da solicitação. Revise a configuração técnica antes de tentar novamente.',
    );
  return result(
    LessonFailureCode.AI_UNKNOWN_ERROR,
    'o provedor retornou um erro não reconhecido. Consulte os logs técnicos do servidor para obter o diagnóstico completo.',
  );
}

/** True when the message embeds a provider error payload such as `{"error":{"code":…}}`. */
function hasUpstreamErrorPayload(raw: string): boolean {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return false;
  try {
    const payload = JSON.parse(raw.slice(start, end + 1)) as LessonJsonObject;
    return Object.keys(lessonAsObject(payload.error)).length > 0;
  } catch {
    return false;
  }
}
