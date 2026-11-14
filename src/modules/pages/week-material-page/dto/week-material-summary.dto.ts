/**
 * Contrato da listagem de páginas de materiais semanais.
 *
 * O card do painel precisa apenas do resumo e de quantos itens de cada tipo a
 * página tem; as mídias em si só são carregadas ao abrir a página.
 */
export class WeekMaterialSummaryDTO {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  /** A página publicada como o material da semana. */
  currentWeek: boolean;
  /** Endereço público da página; `null` quando a rota não existe. */
  routePath: string | null;
  videoCount: number;
  documentCount: number;
  imageCount: number;
  audioCount: number;
  createdAt: string;
  updatedAt: string;
}
