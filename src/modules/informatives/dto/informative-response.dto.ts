/** Contrato de resposta de `/informatives`. */
export class InformativeResponseDto {
  id: string;
  title: string;
  description: string;
  /** Visível para quem não está autenticado. */
  public: boolean;
  /** Endereço público do informativo; `null` quando não tem rota. */
  routePath: string | null;
  createdAt: string;
  updatedAt: string;
}
