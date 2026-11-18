/** How an editor section maps onto a field of `structuredDataJson`. */
export enum CanonicalSectionKind {
  TEXT = 'TEXT',
  LIST = 'LIST',
  /** Keeps the shape (string or string[]) the server already stores. */
  TEXT_OR_LIST = 'TEXT_OR_LIST',
  VERSE = 'VERSE',
  QUESTIONS = 'QUESTIONS',
  NUMBER = 'NUMBER',
}
