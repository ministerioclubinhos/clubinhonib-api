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

export function buildGameInstructionImagePrompt(input: {
  game: JsonObject;
  stepNumber: number;
  instruction: string;
  proposedComposition: string;
}): string {
  return [
    'BRINCADEIRA COMPLETA E APROVADA:',
    JSON.stringify({
      name: input.game.name,
      objective: input.game.objective,
      funMechanics: input.game.funMechanics,
      materials: input.game.materials,
      preparation: input.game.preparation,
      steps: input.game.steps,
      rulesAndSafety: input.game.rulesAndSafety,
      ageAdaptations: input.game.ageAdaptations,
    }),
    `INSTRUÇÃO ${input.stepNumber} QUE ESTA IMAGEM DEVE ENSINAR:`,
    input.instruction.trim(),
    'COMPOSIÇÃO VISUAL PROPOSTA:',
    input.proposedComposition.trim(),
    'REGRA OBRIGATÓRIA: crie uma imagem instrucional que demonstre claramente como executar somente este passo da brincadeira. Mostre posições, materiais, organização e ação necessários. Não produza uma ilustração decorativa genérica e não insira palavras, letras ou números dentro da imagem.',
  ].join('\n\n');
}

export function buildVerseVisualImagePrompt(input: {
  fullVerse: string;
  verseReference: string;
  displayText: string;
  proposedComposition: string;
}): string {
  return [
    'CRIE O CARTÃO TIPOGRÁFICO FINAL E COMPLETO DO VERSÍCULO INFANTIL.',
    `VERSÍCULO COMPLETO NVI, PARA CONTEXTO: "${input.fullVerse.trim()}"`,
    `REFERÊNCIA COMPLETA: "${input.verseReference.trim()}"`,
    `TEXTO OBRIGATÓRIO QUE DEVE APARECER DENTRO DA IMAGEM, EXATAMENTE ASSIM, SEM ALTERAR, OMITIR OU ACRESCENTAR NENHUM CARACTERE: "${input.displayText.trim()}".`,
    'IDENTIDADE VISUAL DE REFERÊNCIA: material infantil vibrante, alegre e luminoso, com fundo azul/ciano, degradês, raios de luz, nuvens estilizadas, brilhos e pequenas formas somente nas bordas.',
    'PALETA OBRIGATÓRIA: use no máximo 3 cores em toda a imagem, incluindo texto, fundo, contornos, sombras e detalhes. É permitido variar apenas luminosidade e saturação dessas mesmas 3 cores. Não introduza uma quarta cor. Preserve exatamente a mesma paleta de 3 cores em todos os cartões da sequência.',
    'Mantenha 95% da área central livre de elementos, com contraste suficiente para receber tipografia extragrande e arredondada, usando somente a paleta definida, com contorno e sombra suaves.',
    'Use somente detalhes abstratos pequenos nas extremidades ou cantos. Eles emolduram o texto sem competir com ele.',
    'O texto deve ocupar aproximadamente 95% da imagem e ser o protagonista absoluto: tipografia infantil extragrande e arredondada. Distribua no máximo as mesmas 3 cores entre palavras ou blocos, sem alternar uma cor diferente para cada letra.',
    'PROIBIDO: pessoas, personagens, rostos, animais, cenários, paisagens, salas, construções, objetos reconhecíveis, cenas bíblicas, outras letras, outras palavras, outros números, símbolos religiosos, molduras pesadas ou elementos competindo com o texto.',
    `Referência estética secundária, sem contrariar as regras: ${input.proposedComposition.trim()}`,
  ].join('\n\n');
}
