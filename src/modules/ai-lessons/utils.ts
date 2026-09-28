export function lessonString(value: unknown): string {
  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
    ? String(value)
    : '';
}

type JsonObject = Record<string, unknown>;

const tiptapNodeText = (node: JsonObject): string => {
  const ownText = lessonString(node.text);
  const children = Array.isArray(node.content)
    ? node.content.map((item) =>
        item && typeof item === 'object'
          ? tiptapNodeText(item as JsonObject)
          : '',
      )
    : [];
  return [ownText, ...children].filter(Boolean).join('');
};

export function extractTiptapSectionText(
  document: JsonObject,
  headingText: string,
): string | null {
  const nodes = Array.isArray(document.content)
    ? document.content.filter(
        (item): item is JsonObject =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item),
      )
    : [];
  const normalizedHeading = headingText.trim().toLocaleUpperCase('pt-BR');
  const start = nodes.findIndex(
    (node) =>
      node.type === 'heading' &&
      tiptapNodeText(node).trim().toLocaleUpperCase('pt-BR') ===
        normalizedHeading,
  );
  if (start < 0) return null;

  const headingLevel = Number(
    (nodes[start].attrs as JsonObject | undefined)?.level ?? 2,
  );
  const sectionNodes = nodes.slice(start + 1);
  const end = sectionNodes.findIndex(
    (node) =>
      node.type === 'heading' &&
      Number((node.attrs as JsonObject | undefined)?.level ?? 2) <=
        headingLevel,
  );
  const content = (end < 0 ? sectionNodes : sectionNodes.slice(0, end))
    .map((node) => tiptapNodeText(node).trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();
  return content || null;
}

export function buildStoryVisualImagePrompt(input: {
  completeStory: string;
  canonicalScene: JsonObject;
  proposedComposition: string;
  hasIdentityReference: boolean;
}): string {
  return [
    'FONTE CANÔNICA E EXCLUSIVA — LIÇÃO BÍBLICA COMPLETA:',
    input.completeStory.trim(),
    'TRECHO DA LIÇÃO DEFINIDO PELA QUEBRA NARRATIVA DA LLM:',
    JSON.stringify(input.canonicalScene),
    'COMPOSIÇÃO VISUAL PROPOSTA:',
    input.proposedComposition.trim(),
    'IDENTIDADE VISUAL FIXA:',
    input.hasIdentityReference
      ? 'Use a imagem de referência anexada como identidade-mãe. Preserve rigorosamente os mesmos personagens, rostos, idades aparentes, cabelos, roupas, proporções, traço artístico, paleta de cores, iluminação e representação dos ambientes. A referência define somente a identidade visual; a ação deve seguir a cena atual.'
      : 'Esta é a imagem-mãe da sequência. Estabeleça personagens, rostos, idades aparentes, cabelos, roupas, proporções, traço artístico, paleta de cores, iluminação e ambientes de forma clara e reutilizável nas próximas cenas.',
    'REGRA OBRIGATÓRIA: produza somente a cena aprovada acima, usando exclusivamente personagens, ações, objetos, ambientes e emoções explicitamente presentes na LIÇÃO BÍBLICA completa. Não invente, acrescente, substitua ou antecipe qualquer elemento narrativo.',
  ].join('\n\n');
}
