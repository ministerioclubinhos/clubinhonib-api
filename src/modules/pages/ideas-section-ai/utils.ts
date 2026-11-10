import { Readable } from 'node:stream';
import { IdeaAiArtifact, IdeaAiGuard } from './types';
import type { EnhancedIdeaDocumentDto } from './dto/enhanced-idea.dto';
import { IdeaDocumentBlockType } from './enums/enhanced-idea.enums';
export function checkIdeaEssence(
  original: string,
  enhanced: string,
): IdeaAiGuard {
  const violations: string[] = [];
  const tokens = (text: string, pattern: RegExp): string[] => [
    ...new Set(text.match(pattern) ?? []),
  ];
  const references = /(?:[1-3]\s*)?[A-ZÀ-Ý][a-zà-ÿ]+\s+\d+:\d+(?:[-–,]\d+)*/g;
  const numbers = /\b\d+(?:[.,:]\d+)*(?:[-–]\d+)?\b/g;
  const urls = /https?:\/\/[^\s)]+/g;
  const names = /\b[A-ZÀ-Ý][a-zà-ÿ]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ]+)+/g;
  for (const reference of tokens(enhanced, references))
    if (!tokens(original, references).includes(reference))
      violations.push('Uma referência bíblica foi alterada ou acrescentada.');
  for (const number of tokens(original, numbers))
    if (!tokens(enhanced, numbers).includes(number))
      violations.push(
        'Uma quantidade, idade ou referência numérica foi removida.',
      );
  for (const number of tokens(enhanced, numbers))
    if (!tokens(original, numbers).includes(number))
      violations.push('Uma quantidade ou etapa numérica foi acrescentada.');
  for (const name of tokens(original, names))
    if (
      !enhanced
        .toLocaleLowerCase('pt-BR')
        .includes(
          name
            .replace(
              /^(?:Leia|Use|Forme|Separe|Conte|Com|Para|Depois|Antes)\s+/,
              '',
            )
            .toLocaleLowerCase('pt-BR'),
        )
    )
      violations.push('Um nome próprio pode ter sido alterado.');
  for (const url of tokens(enhanced, urls))
    if (!tokens(original, urls).includes(url))
      violations.push('Uma URL foi acrescentada.');
  if (/<\/?[a-z][^>]*>/i.test(enhanced))
    violations.push('A resposta contém HTML.');
  if (
    enhanced.length < original.length * 0.6 ||
    enhanced.length > original.length * 2.5 + 300
  )
    violations.push('O tamanho do conteúdo mudou além do permitido.');
  return { approved: !violations.length, violations: [...new Set(violations)] };
}
export function ideaDocumentText(document: EnhancedIdeaDocumentDto): string {
  return [
    document.title,
    ...document.sections.flatMap((s) => [
      s.heading,
      ...s.blocks.flatMap((b) => [
        b.text,
        ...b.items.map((item, index) =>
          b.type === IdeaDocumentBlockType.NUMBERED_LIST
            ? `${index + 1}. ${item}`
            : item,
        ),
      ]),
    ]),
  ]
    .filter(Boolean)
    .join('\n');
}
export function ideaArtifactFile(
  artifact: IdeaAiArtifact,
): Express.Multer.File {
  return {
    buffer: artifact.buffer,
    size: artifact.buffer.length,
    mimetype: artifact.mimeType,
    originalname: artifact.name,
    fieldname: 'artifact',
    encoding: '7bit',
    destination: '',
    filename: artifact.name,
    path: '',
    stream: Readable.from(artifact.buffer),
  };
}

/** Compare explicitly labelled activities/sections and numbered steps detected in extracted text. */
export function checkIdeaDocumentStructure(
  original: string,
  document: EnhancedIdeaDocumentDto,
): IdeaAiGuard {
  const enhanced = ideaDocumentText(document);
  const violations: string[] = [];
  const labels =
    /^[ \t]*(?:atividade|etapa|parte|seção|secao|passo)[ \t]*(?:\d+|[:.\-–])/gim;
  const numbered = /^[ \t]*\d+[.)][ \t]+\S/gm;
  for (const pattern of [labels, numbered]) {
    const before = original.match(pattern)?.length ?? 0;
    const after = enhanced.match(pattern)?.length ?? 0;
    if (before !== after)
      violations.push(
        'A quantidade de seções, atividades ou etapas detectadas foi alterada.',
      );
  }
  return { approved: !violations.length, violations: [...new Set(violations)] };
}
