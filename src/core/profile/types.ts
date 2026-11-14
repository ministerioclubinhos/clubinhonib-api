/**
 * Quem está pedindo a operação.
 *
 * Os casos de uso recebem isto, e não a requisição HTTP: quem lê o token é o
 * controller, que é a camada que enxerga o transporte.
 */
export interface ProfileAccessContext {
  role?: string;
  userId?: string | null;
}

/**
 * O que o mapper precisa saber do usuário.
 *
 * Só estes cinco campos entram na resposta, então exigir a entidade inteira
 * impediria a listagem — que lê os perfis por consulta direta — de usar o
 * mesmo mapper.
 */
export interface ProfileUserSource {
  id: string;
  email: string;
  phone: string;
  name: string;
  role: string;
}

/** Linha da faixa de aniversariantes, no recorte mínimo que a tela mostra. */
export interface ProfileBirthdayRow {
  id: string;
  name: string;
  role: string;
  /** `YYYY-MM-DD` ou `Date`, conforme o driver. */
  birthDate: string | Date;
}
