import { DecisionType } from 'src/modules/accepted-christs/enums/decision-type.enum';

/**
 * Constantes e conjuntos finitos do módulo de crianças.
 *
 * Ficam num arquivo só para o DTO de consulta, o repositório e a documentação
 * não discordarem sobre o que a listagem aceita.
 */

/** Paginação da listagem. */
export const CHILDREN_DEFAULT_PAGE = 1;
export const CHILDREN_DEFAULT_LIMIT = 20;
export const CHILDREN_MAX_LIMIT = 100;

/** Campo pelo qual a listagem pode ser ordenada. */
export enum ChildSortField {
  NAME = 'name',
  BIRTH_DATE = 'birthDate',
  JOINED_AT = 'joinedAt',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
}

/** Direção da ordenação. */
export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export const CHILDREN_DEFAULT_SORT = ChildSortField.NAME;
export const CHILDREN_DEFAULT_ORDER = SortOrder.ASC;

/**
 * Coluna do banco por campo de ordenação.
 *
 * A consulta nunca interpola o valor recebido: só um destes nomes chega ao SQL.
 */
export const CHILD_SORT_COLUMNS: Record<ChildSortField, string> = {
  [ChildSortField.NAME]: 'c.name',
  [ChildSortField.BIRTH_DATE]: 'c.birthDate',
  [ChildSortField.JOINED_AT]: 'c.joinedAt',
  [ChildSortField.CREATED_AT]: 'c.createdAt',
  [ChildSortField.UPDATED_AT]: 'c.updatedAt',
};

/** Tamanho máximo dos textos livres do cadastro. */
export const CHILD_TEXT_MAX_LENGTH = 255;
export const CHILD_TEXT_MIN_LENGTH = 2;

/**
 * Ordenação fixa da listagem enxuta.
 *
 * `/children/simple` alimenta seletores: ativas primeiro, em ordem alfabética.
 * Não aceita ordenação do cliente, e o contrato declara qual usou.
 */
export const CHILDREN_SIMPLE_ORDER_BY = ChildSortField.NAME;
export const CHILDREN_SIMPLE_ORDER = SortOrder.ASC;

/**
 * Decisões que contam como "aceitou a Jesus".
 *
 * O filtro `acceptedChrist` da listagem enxuta considera estas duas; o valor
 * vem do enum do módulo de decisões para os dois lados não divergirem.
 */
export const CHILD_DECIDED_DECISIONS: readonly DecisionType[] = [
  DecisionType.ACCEPTED,
  DecisionType.RECONCILED,
];
