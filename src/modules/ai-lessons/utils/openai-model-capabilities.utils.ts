import { OpenAiReasoningEffort } from '../constants/ai-provider-settings.constants';

export function supportsOpenAiReasoning(model: string): boolean {
  return (
    /^(?:gpt-[56](?:[.-]|$)|o[134](?:-|$))/.test(model) &&
    !model.includes('-chat')
  );
}

/** o-series models always reason: they reject the `none` effort. */
export function isOpenAiOSeries(model: string): boolean {
  return /^o[134](?:-|$)/.test(model);
}

/** Effort to send, or undefined when the field must be omitted for the model. */
export function openAiReasoningEffort(
  model: string,
  configured: string | undefined,
): string | undefined {
  const effort = (configured ?? '').trim();
  if (!effort || !supportsOpenAiReasoning(model)) return undefined;
  if (effort === String(OpenAiReasoningEffort.NONE) && isOpenAiOSeries(model))
    return undefined;
  return effort;
}
