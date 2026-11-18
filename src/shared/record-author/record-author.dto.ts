/**
 * Quem gravou um registro, no contrato de resposta.
 *
 * Só o id e o nome: é o que a tela precisa para dizer "lançado por Fulana", e
 * nada mais do usuário sai junto.
 */
export class RecordAuthorDto {
  id: string;
  name: string;
}
