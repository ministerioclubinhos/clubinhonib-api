/**
 * Contrato da listagem de páginas de vídeos.
 *
 * O card do painel precisa apenas do resumo; os vídeos em si só são carregados
 * ao abrir a página.
 */
export class VideoPageSummaryDto {
  id: string;
  title: string;
  description: string;
  public: boolean;
  /** Endereço público da página; `null` quando a rota não existe. */
  routePath: string | null;
  /** Quantos vídeos a página tem. */
  videoCount: number;
  createdAt: string;
  updatedAt: string;
}
