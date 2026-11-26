/** Por que o lançamento de pagelas está fechado. */
export enum PagelaLaunchClosedReason {
  /** Não há período letivo ativo cadastrado por perto de hoje. */
  NO_PERIOD = 'NO_PERIOD',
  /** O próximo período letivo ainda não começou. */
  NOT_STARTED = 'NOT_STARTED',
  /** O último período letivo já terminou. */
  ENDED = 'ENDED',
}
