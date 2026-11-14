/**
 * Contrato da listagem de páginas de ideias.
 *
 * A listagem do painel não carrega seções nem mídias: o card mostra só o
 * resumo, e trazer o conteúdo inteiro de cada página era o que fazia a tela
 * demorar a abrir.
 */
export class IdeasPageSummaryDto {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  public: boolean;
  /** Endereço da página; `null` quando a rota não existe. */
  routePath: string | null;
  /** Quantas seções a página tem. */
  sectionCount: number;
  createdAt: string;
  updatedAt: string;
}
