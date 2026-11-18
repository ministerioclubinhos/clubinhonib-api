/**
 * Contrato da listagem de galerias.
 *
 * A listagem do painel não carrega seções nem mídias: o card mostra só o
 * resumo, e trazer o conteúdo inteiro de cada galeria era o que fazia a tela
 * demorar a abrir.
 */
export class ImagePageSummaryDto {
  id: string;
  title: string;
  description: string;
  public: boolean;
  /** Endereço público da galeria; `null` quando a rota não existe. */
  routePath: string | null;
  /** Quantas seções a galeria tem. */
  sectionCount: number;
  createdAt: string;
  updatedAt: string;
}
