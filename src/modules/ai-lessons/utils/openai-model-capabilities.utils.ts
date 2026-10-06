export function supportsOpenAiReasoning(model: string): boolean {
  return (
    /^(?:gpt-[56](?:[.-]|$)|o[134](?:-|$))/.test(model) &&
    !model.includes('-chat')
  );
}
