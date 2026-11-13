import {
  LESSON_VERSE_REFERENCE_EXCERPT_PREFIX,
  LESSON_VERSE_REFERENCE_EXCERPT_SUFFIX,
  LESSON_VERSE_REFERENCE_VERSION_SUFFIX,
} from './constants/lesson-canonical-content.constants';
import { LessonCategory } from './enums/lesson.enums';

export function lessonString(value: unknown): string {
  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
    ? String(value)
    : '';
}

export function lessonHeaderLines(
  title: string,
  weekNumber?: number | null,
  category?: LessonCategory | null,
): string[] {
  const isSpecial = category === LessonCategory.SPECIAL;
  const prefix = /^LIÇÃO(?:\s+ESPECIAL)?\s*(\d+)?\s*(?:[–—:-]\s*|\r?\n\s*|$)/i;
  const match = title.trim().match(prefix);
  const number = weekNumber ?? (match?.[1] ? Number(match[1]) : undefined);
  const label = isSpecial ? 'LIÇÃO ESPECIAL' : 'LIÇÃO';
  const cleanTitle = title
    .trim()
    .replace(prefix, '')
    .replace(/^TÍTULO\s*\r?\n\s*/i, '')
    .trim();
  return [
    number === undefined ? label : `${label} ${number}`,
    'TÍTULO',
    cleanTitle,
  ].filter(Boolean);
}

type JsonObject = Record<string, unknown>;

export function normalizeLessonDocumentHeader(
  document: JsonObject,
  weekNumber?: number | null,
  category?: LessonCategory | null,
): JsonObject {
  const label =
    category === LessonCategory.SPECIAL ? 'LIÇÃO ESPECIAL' : 'LIÇÃO';
  const expectedFirst =
    weekNumber === undefined || weekNumber === null
      ? label
      : `${label} ${weekNumber}`;
  const nodes: JsonObject[] = Array.isArray(document.content)
    ? document.content.filter(
        (item: unknown): item is JsonObject =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item),
      )
    : [];
  const first = nodes[0] as JsonObject | undefined;
  if (!first || first.type !== 'heading') return document;
  const title = tiptapNodeText(first).trim();
  const second = nodes[1] as JsonObject | undefined;
  if (second && tiptapNodeText(second).trim() === 'TÍTULO') {
    if (
      (weekNumber === undefined || weekNumber === null) &&
      category !== LessonCategory.SPECIAL
    )
      return document;
    if (title === expectedFirst) return document;
    nodes[0] = {
      ...first,
      content: [{ type: 'text', text: expectedFirst }],
    };
  } else {
    nodes.splice(
      0,
      1,
      ...lessonHeaderLines(title, weekNumber, category).map((text) => ({
        ...first,
        content: [{ type: 'text', text }],
      })),
    );
  }
  return { ...document, content: nodes };
}

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
    .map((node) => {
      const text = tiptapNodeText(node).trim();
      return node.type === 'heading' && text ? `### ${text}` : text;
    })
    .filter(Boolean)
    .join('\n\n')
    .trim();
  return content || null;
}

export function buildStoryVisualImagePrompt(input: {
  category?: LessonCategory;
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
    input.category === LessonCategory.SPECIAL
      ? 'Preserve o estilo, a paleta e a identidade somente dos personagens que reaparecem no trecho. Respeite mudanças de época, idade, roupa e ambiente explicitamente narradas; não copie a cena ou o elenco da imagem-mãe para outra época. Dicas ao professor são orientações de apresentação, não objetos ou ações da história.'
      : input.hasIdentityReference
        ? 'Use a imagem de referência anexada como identidade-mãe. Preserve rigorosamente os mesmos personagens, rostos, idades aparentes, cabelos, roupas, proporções, traço artístico, paleta de cores, iluminação e representação dos ambientes. A referência define somente a identidade visual; a ação deve seguir a cena atual.'
        : 'Esta é a imagem-mãe da sequência. Estabeleça personagens, rostos, idades aparentes, cabelos, roupas, proporções, traço artístico, paleta de cores, iluminação e ambientes de forma clara e reutilizável nas próximas cenas.',
    'REGRA OBRIGATÓRIA: produza somente a cena aprovada acima, usando exclusivamente personagens, ações, objetos, ambientes e emoções explicitamente presentes na LIÇÃO BÍBLICA completa. Não invente, acrescente, substitua ou antecipe qualquer elemento narrativo.',
  ].join('\n\n');
}

/**
 * Prompt of one cutout sheet. The sheet is a closed list: the lesson text is
 * left out on purpose, because with it (or with a reference image) the model
 * drew the whole story on every sheet instead of only the listed elements.
 */
export function buildCutoutKitImagePrompt(input: {
  category: string;
  title?: string;
  items: JsonObject[];
  layoutPlan?: string;
  proposedComposition: string;
  hasIdentityReference: boolean;
}): string {
  const items = input.items.map((item) => ({
    label: item.label,
    description: item.description,
    size: item.size,
    variantOf: item.variantOf ?? undefined,
  }));
  const labels = items
    .map((item) => lessonString(item.label).trim())
    .filter(Boolean)
    .join('; ');
  const count = items.length;
  const closedList = `LISTA FECHADA: esta prancha contém exatamente ${count} ${count === 1 ? 'elemento' : 'elementos'} — ${labels}. Desenhe cada item da lista uma única vez. Nenhum outro personagem, animal, objeto, construção, planta ou peça de cenário pode aparecer, mesmo que faça parte da mesma história.`;
  return [
    `PRANCHA DE ELEMENTOS PARA RECORTAR — CATEGORIA ${input.category}${input.title ? ` (${input.title})` : ''}.`,
    closedList,
    'ELEMENTOS DESTA PRANCHA:',
    JSON.stringify(items),
    'ORGANIZAÇÃO PLANEJADA:',
    [input.layoutPlan, input.proposedComposition]
      .map((part) => lessonString(part).trim())
      .filter(Boolean)
      .join('\n'),
    'REGRAS DE PRANCHA DE RECORTES:',
    [
      'Prancha de elementos para recortar: cada elemento fica isolado, com corpo ou objeto inteiro, sem cortes pelas bordas e com margem segura na borda da imagem.',
      'Deixe espaço branco de pelo menos 8% entre os elementos. Sem sobreposição e sem sombras projetadas no chão que se misturem com outros elementos (sombra suave opcional, contida no próprio elemento).',
      'Sem cena, sem horizonte compartilhado e sem fundo colorido contínuo. Fundo branco puro. Cenário (montanhas, mar, céu) somente em faixas ou peças recortáveis separadas; nuvens, sol, lua e estrelas sempre como peças soltas.',
      'Elementos grandes e nítidos, bordas completas, nada espremido nem minúsculo, mesmo que sobre espaço em branco. Peças pequenas só quando o objeto é naturalmente pequeno (pássaro, peixe, estrela).',
      'Mantenha a escala relativa coerente (adulto ≈ 1,0; criança ≈ 0,6; casa ≈ 3,0; árvore ≈ 2,5). Personagens de frente ou 3/4, pose neutra, corpo inteiro e pés visíveis. Multidão sem rosto como silhuetas cinza.',
      'Não escreva letras, números, legendas ou logotipos: os nomes são aplicados depois pelo sistema.',
    ].join(' '),
    'IDENTIDADE VISUAL:',
    input.hasIdentityReference
      ? 'A imagem anexada é SOMENTE um guia de estilo: copie dela o traço artístico, o contorno, a paleta, o sombreamento e as proporções. NÃO redesenhe, não copie e não reaproveite os elementos que aparecem nela — eles pertencem a outra prancha. Só quando um item da lista fechada for um personagem que também está na referência, mantenha o mesmo rosto, idade aparente, cabelo e roupa.'
      : 'Esta é a prancha-mãe do kit. Estabeleça com clareza o traço artístico, a paleta de cores, as proporções e as características (rosto, idade aparente, cabelo, roupa) que serão reutilizados nas demais pranchas.',
    `CONFERÊNCIA FINAL OBRIGATÓRIA: a imagem deve mostrar somente ${labels} (${count} ${count === 1 ? 'elemento' : 'elementos'}). Qualquer elemento fora dessa lista deve ser removido. Nada violento, assustador ou sexualizado.`,
  ].join('\n\n');
}

/** Legacy per-step games: one instructional image per step. */
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

/** The fun game's single image: an infographic that compiles the whole game. */
export function buildGameSummaryImagePrompt(input: {
  game: JsonObject;
  proposedComposition: string;
}): string {
  const steps = Array.isArray(input.game.steps) ? input.game.steps : [];
  const text = (value: unknown): string =>
    typeof value === 'string' ? value.trim() : '';
  const verse = text(input.game.verseText);
  const reference = text(input.game.verseReference);
  return [
    'CRIE UM INFOGRÁFICO INFANTIL VERTICAL (RETRATO, FOLHA A4) QUE COMPILA UMA ÚNICA BRINCADEIRA.',
    ...(verse
      ? [
          `É A BRINCADEIRA DE FIXAÇÃO DESTE VERSÍCULO. Logo abaixo do título, uma faixa de destaque com o versículo escrito EXATAMENTE ASSIM, sem alterar, omitir ou acrescentar nenhum caractere: "${verse}" — e, em seguida, a referência "${reference}". Fora dessa faixa, não escreva o versículo de novo.`,
        ]
      : []),
    'BRINCADEIRA COMPLETA E APROVADA:',
    JSON.stringify({
      name: input.game.name,
      objective: input.game.objective,
      materials: input.game.materials,
      preparation: input.game.preparation,
      steps: input.game.steps,
      rulesAndSafety: input.game.rulesAndSafety,
    }),
    'COMPOSIÇÃO VISUAL PROPOSTA:',
    input.proposedComposition.trim(),
    `ESTRUTURA OBRIGATÓRIA, DE CIMA PARA BAIXO: (1) o nome da brincadeira como título grande e colorido no topo; (2) uma faixa "MATERIAIS" com ícones simples de cada material; (3) uma faixa "PREPARAÇÃO" mostrando como montar o espaço; (4) um caminho com exatamente ${steps.length} paradas numeradas em ordem (bandeirinhas ou círculos com os números 1 a ${steps.length}), cada parada com um título curto do passo e um ícone ou desenho simples da ação, ligadas por setas; (5) um quadro final de destaque com a regra de encerramento ou como o grupo vence.`,
    `TEXTO NA IMAGEM (OBRIGATÓRIO, nenhuma faixa ou placa em branco): título "${text(input.game.name)}"; faixas "MATERIAIS", "PREPARAÇÃO" e "COMO BRINCAR"; em cada parada, o número dentro do círculo ou bandeirinha e, ao lado, um título curto do passo sem repetir o número (no máximo 5 palavras, resumindo o passo correspondente); no quadro final, uma frase curta de encerramento. Escreva em português do Brasil com ortografia e acentuação corretas; não invente palavras e não escreva parágrafos.`,
    'ESTILO: ilustração infantil alegre, com contornos de caneta e cores vivas e claras, fundo de campo ou parque suave, placas de madeira, faixas coloridas e ícones simples. Cartões e faixas organizados, com bastante respiro e leitura fácil.',
    'CRIANÇAS BRINCANDO (OBRIGATÓRIO): em cada parada do passo a passo e no quadro final, mostre crianças genéricas de 5 a 11 anos, diversas, em traço infantil simples, fazendo a ação com expressões de alegria, empolgação e torcida (correndo, pulando, arremessando, comemorando). O clima é de festa e gincana, como um cartaz de recreação: cores vivas, movimento, linhas de ação, confetes ou bandeirinhas. Não faça um infográfico só de objetos.',
    'É uma única brincadeira: não mostre várias brincadeiras, horários nem programação do dia. Sem personagens bíblicos e sem cenas da história. Nada violento, assustador ou perigoso.',
  ].join('\n\n');
}

/** First and last characters of a verse card, so no neighbouring punctuation leaks in. */
export function verseCardEdgeRule(displayText: string): string {
  const text = displayText.trim();
  const chars = Array.from(text);
  if (!chars.length) return '';
  return `O texto começa com "${chars[0]}" e termina com "${chars[chars.length - 1]}". Não acrescente vírgula, ponto ou qualquer sinal que não esteja no texto obrigatório, nem no início nem no fim.`;
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
    verseCardEdgeRule(input.displayText),
    'IDENTIDADE VISUAL: material infantil vibrante, alegre e luminoso. O fundo e a paleta NÃO são fixos e não devem ser azul com nuvens por padrão: escolha-os a partir do sentido do versículo completo (por exemplo, tons de pergaminho e terra para a Lei e os Profetas, céu noturno para estrelas, verdes para a criação, tons quentes para amor e alegria). Fundo simples — cor chapada, degradê suave ou textura leve — com bom contraste para o texto. Mantenha o mesmo fundo e a mesma paleta em todos os cartões da sequência.',
    'PALETA OBRIGATÓRIA: use no máximo 3 cores em toda a imagem, incluindo texto, fundo, contornos, sombras e detalhes. É permitido variar apenas luminosidade e saturação dessas mesmas 3 cores. Não introduza uma quarta cor. Preserve exatamente a mesma paleta de 3 cores em todos os cartões da sequência.',
    'PROPORÇÃO 90/10, NESTA ORDEM: (1) PRIMEIRO o texto — tipografia infantil extragrande e arredondada que ocupa cerca de 90% da imagem, com a caixa do texto indo de uma lateral à outra e de cima a baixo, deixando só uns 5% de folga em cada borda; contorno e sombra numa das cores da paleta (nunca contorno branco); no máximo as mesmas 3 cores entre palavras ou blocos, sem uma cor diferente para cada letra. (2) DEPOIS os detalhes, somente nas sobras.',
    'DETALHES (no máximo 10% da imagem, somados): desenhos MINÚSCULOS — cada um com no máximo 3% da largura da imagem — encaixados apenas nas sobras. A quantidade NÃO é fixa: decida pelo espaço que o texto deixou livre (trecho curto deixa mais sobra, trecho longo deixa menos), pelo estilo e pelo sentido do trecho. Sobras ficam em: cantos, folga das bordas e vãos entre as linhas e no fim das linhas curtas. Eles remetem ao sentido DESTE trecho e do versículo (ex.: ouvido e ondas de som para "ouvir", pergaminho e tábuas da Lei para "Moisés e os Profetas", coração para "amor", estrela para "luz"), misturados com brilhos e pontinhos da mesma paleta; varie os desenhos, sem repetir o mesmo ícone em todos os cantos. No cartão da referência, Bíblia aberta, marcador de página e brilhos. NUNCA diminua o texto para abrir espaço a detalhes: se não couber, use menos detalhes. Nenhum detalhe toca ou cobre as letras.',
    'SEM BORDA BRANCA: nada de moldura, margem, faixa ou contorno branco ao redor do cartão ou das letras; o fundo vai até as bordas.',
    'PROIBIDO: pessoas, personagens, rostos, cenas e paisagens completas, cenas bíblicas, outras letras, palavras ou números, logotipos, molduras ou detalhes grandes que disputem espaço com o texto.',
    `Referência estética secundária, sem contrariar as regras: ${input.proposedComposition.trim()}`,
    'Se a referência estética citar outro texto, outra pontuação ou um trecho vizinho do versículo, ignore: dentro da imagem vale somente o TEXTO OBRIGATÓRIO acima.',
  ].join('\n\n');
}

export function lessonStoryHeading(line: string): string | undefined {
  return line.trim().match(/^###\s+(.+?)\s*$/)?.[1];
}

export function normalizeLessonVerseReference(value: unknown): string {
  const withoutVersion = (text: string): string =>
    text.replace(LESSON_VERSE_REFERENCE_VERSION_SUFFIX, '').trim();
  // "(trecho)" marks a partial verse; the letter after the verse (8b) already says so.
  return withoutVersion(
    withoutVersion(lessonString(value).trim())
      .replace(LESSON_VERSE_REFERENCE_EXCERPT_PREFIX, '')
      .replace(LESSON_VERSE_REFERENCE_EXCERPT_SUFFIX, ''),
  );
}

/** Verse text without the quotation marks it may already carry: the layouts add their own. */
export function unquoteLessonVerse(value: string): string {
  return value
    .trim()
    .replace(/^[“”"\s]+/, '')
    .replace(/[“”"\s]+$/, '');
}
