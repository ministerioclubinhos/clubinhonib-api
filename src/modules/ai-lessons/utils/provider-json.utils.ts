import { PROVIDER_JSON_DIAGNOSTIC_EDGE } from '../providers/lesson-llm.constants';

const CODE_FENCE = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;

function parseObject(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * The JSON object of a structured response. Providers may split the answer in
 * several text blocks, wrap it in a ```json fence or add a stray line around
 * it; each candidate is tried as is, unfenced and cut to its outer braces.
 */
export function parseProviderJsonObject(
  candidates: ReadonlyArray<string | undefined>,
): Record<string, unknown> | null {
  for (const candidate of candidates) {
    const text = candidate?.trim();
    if (!text) continue;
    const unfenced = text.match(CODE_FENCE)?.[1] ?? text;
    const start = unfenced.indexOf('{');
    const end = unfenced.lastIndexOf('}');
    const parsed =
      parseObject(unfenced) ??
      (start >= 0 && end > start
        ? parseObject(unfenced.slice(start, end + 1))
        : null);
    if (parsed) return parsed;
  }
  return null;
}

/** What an unreadable answer looked like, short enough for a log line. */
export function providerJsonDiagnostic(blocks: readonly string[]): string {
  const joined = blocks.join('');
  const edge = PROVIDER_JSON_DIAGNOSTIC_EDGE;
  const oneLine = (value: string) => value.replace(/\s+/g, ' ');
  return `blocos=${blocks.length} tamanho=${joined.length} início="${oneLine(joined.slice(0, edge))}" fim="${oneLine(joined.slice(-edge))}"`;
}
