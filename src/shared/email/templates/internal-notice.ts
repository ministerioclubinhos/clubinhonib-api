import { EmailContent } from '../types';
import { joinTextLines } from '../utils';
import {
  button,
  composeBody,
  DataRow,
  dataTable,
  heading,
  linkFallback,
  quoteBlock,
} from './blocks';
import { renderEmailLayout } from './layout';

/** Bloco de texto longo do aviso, como uma mensagem ou uma descrição. */
export interface NoticeSection {
  heading: string;
  text?: string;
}

/** Item que pode não existir naquele aviso. */
type Optional<T> = T | null | undefined | false;

export interface InternalNoticeParams {
  subject: string;
  /** Vai no cabeçalho do e-mail. */
  title: string;
  /** Primeira frase da versão em texto puro. */
  intro: string;
  /** Título da tabela de dados. */
  detailsHeading: string;
  rows: Optional<DataRow>[];
  sections?: Optional<NoticeSection>[];
  /** Para onde ir para resolver o aviso; some quando não há URL. */
  action?: Optional<{ label: string; url: string }>;
}

const isPresent = <T>(value: Optional<T>): value is T => Boolean(value);

const hasValue = (row: DataRow): boolean => row.value.trim().length > 0;

const hasText = (section: NoticeSection): boolean =>
  Boolean(section.text?.trim());

/**
 * Aviso interno enviado aos administradores: uma tabela de dados e, quando
 * existe, um ou mais blocos de texto.
 *
 * O HTML e a versão em texto saem da **mesma** declaração de linhas. Antes cada
 * template escrevia as duas versões à mão, e elas já tinham divergido na ordem
 * dos campos — mudar uma e esquecer a outra era questão de tempo.
 *
 * Linha sem valor e bloco sem texto simplesmente não aparecem, então um campo
 * opcional não precisa de `if` no template.
 */
export function internalNoticeEmail({
  subject,
  title,
  intro,
  detailsHeading,
  rows,
  sections = [],
  action,
}: InternalNoticeParams): EmailContent {
  const visibleRows = rows.filter(isPresent).filter(hasValue);
  const visibleSections = sections.filter(isPresent).filter(hasText);
  const visibleAction = isPresent(action) && action.url.trim() ? action : null;

  const html = renderEmailLayout({
    title,
    body: composeBody([
      heading(detailsHeading),
      dataTable(visibleRows),
      ...visibleSections.flatMap((section) => [
        heading(section.heading),
        quoteBlock(section.text as string),
      ]),
      ...(visibleAction
        ? [
            button(visibleAction.label, visibleAction.url),
            linkFallback(visibleAction.url),
          ]
        : []),
    ]),
  });

  const text = joinTextLines([
    intro,
    '',
    ...visibleRows.map((row) => `${row.label}: ${row.value}`),
    ...visibleSections.flatMap((section) => [
      '',
      `${section.heading}:`,
      section.text as string,
    ]),
    ...(visibleAction
      ? ['', `${visibleAction.label}: ${visibleAction.url}`]
      : []),
  ]);

  return { subject, html, text };
}
