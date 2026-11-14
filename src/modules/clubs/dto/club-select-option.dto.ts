/** Opção de clubinho usada nos seletores dos formulários. */
export class ClubSelectOptionDto {
  id: string;
  /** Rótulo pronto: `Clubinho 12 : Centro`. */
  label: string;
  /** Indica se o clubinho já tem coordenador. */
  coordinator: boolean;
}
