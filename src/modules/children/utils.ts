/**
 * Funções puras do módulo de crianças.
 *
 * Antes cada serviço carregava a sua cópia de `toDateOnlyStr`, e as quatro já
 * podiam divergir sem que nada acusasse.
 */
import { AppForbiddenException, ErrorCode } from 'src/shared/exceptions';
import { AccessContext, UserRole } from 'src/core/auth/auth.types';

import { PHONE_SEARCH_PATTERN } from './constants';

/**
 * Só administrador exclui uma criança.
 *
 * É a única operação sobre a criança fechada para quem cuida do clubinho, e a
 * razão é ser a única irreversível: a linha some, e com ela o histórico de
 * pagelas e a presença nas estatísticas. **Desativar** cobre a necessidade real
 * — "esta criança não vem mais" — mantendo o registro e podendo ser desfeito.
 *
 * A rota não tinha guarda de papel nenhuma: quem enxergava a criança podia
 * apagá-la. Como o recorte por papel também entrega as crianças **sem
 * clubinho**, um professor conseguia excluir qualquer criança ainda não
 * vinculada.
 */
export function assertCanDeleteChild(context: AccessContext): void {
  if (context.role === UserRole.ADMIN) return;

  throw new AppForbiddenException(
    ErrorCode.CHILD_ACCESS_DENIED,
    'Apenas um administrador pode excluir uma criança. ' +
      'Para registrar que ela não frequenta mais, desative-a.',
  );
}

/**
 * Data em `YYYY-MM-DD`.
 *
 * As colunas de nascimento e entrada são de data pura e podem voltar como
 * `Date` ou como texto, conforme o driver. Cortar no `T` mantém o dia do
 * calendário sem passar por fuso.
 */
export function toDateOnly(
  value: string | Date | undefined | null,
): string | null {
  if (value === undefined || value === null) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  const dateOnly = text.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (dateOnly) return dateOnly[1];

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toISOString().slice(0, 10);
}

/** Carimbo completo em ISO; entrada inválida vira o instante atual. */
export function toIsoDateTime(value: unknown): string {
  const text = String(value);
  if (/\d{4}-\d{2}-\d{2}T/.test(text)) return text;

  const parsed = value instanceof Date ? value : new Date(text);
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}

/**
 * Quem pode mudar o clubinho de uma criança.
 *
 * O professor cuida da turma dele: edita a criança, mas não a move nem a
 * desvincula. Antes o formulário oferecia o campo e a API aceitava — e o
 * caminho mais fácil, limpar o campo, não tinha checagem nenhuma.
 *
 * O coordenador troca entre os clubinhos que coordena; o destino continua sendo
 * conferido depois, contra o escopo dele.
 */
export function assertCanChangeChildClub(context: AccessContext): void {
  if (context.role !== UserRole.TEACHER) return;

  throw new AppForbiddenException(
    ErrorCode.CHILD_ACCESS_DENIED,
    'Um professor não altera o clubinho de uma criança. ' +
      'Peça à coordenação para transferi-la.',
  );
}

/**
 * Desvincular é só do administrador.
 *
 * Uma criança sem clubinho sai do alcance de quem a acompanhava e passa a
 * aparecer para todos os papéis — o recorte por papel entrega as crianças sem
 * clubinho a qualquer professor ou coordenador. Tirar o vínculo é, na prática,
 * soltar a criança da estrutura, e isso não é decisão de uma coordenação só.
 */
export function assertCanUnlinkChildClub(context: AccessContext): void {
  if (context.role === UserRole.ADMIN) return;

  throw new AppForbiddenException(
    ErrorCode.CHILD_ACCESS_DENIED,
    'Apenas um administrador pode deixar uma criança sem clubinho. ' +
      'Para movê-la, escolha o novo clubinho.',
  );
}

/**
 * Trecho do telefone a procurar, só com os dígitos.
 *
 * O telefone é gravado sem máscara; quem busca digita `(92) 99999`. Só vale
 * quando o texto é um telefone — dígitos e pontuação de máscara. Com letra no
 * meio é busca por nome: sem essa trava, "Ana 3" casava com todo telefone que
 * tivesse um 3.
 */
export function phoneSearchDigits(search: string): string | null {
  if (!PHONE_SEARCH_PATTERN.test(search.trim())) return null;

  const digits = search.replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
}

/**
 * Sem clubinho, só o administrador cadastra.
 *
 * Uma criança sem clubinho aparece para todos os papéis; professor e
 * coordenador cadastram sempre dentro de um clubinho que alcançam.
 */
export function assertCanCreateChildWithoutClub(context: AccessContext): void {
  if (context.role === UserRole.ADMIN) return;

  throw new AppForbiddenException(
    ErrorCode.CHILD_ACCESS_DENIED,
    'Informe o clubinho da criança. Apenas um administrador cadastra criança sem clubinho.',
  );
}

/**
 * Dia da desativação a gravar quando a situação da criança muda.
 *
 * Desativar carimba o dia de hoje; reativar limpa. Sem mudança de situação o
 * carimbo fica como estava — reenviar `isActive: false` não empurra a data.
 */
export function deactivationStamp(input: {
  wasActive: boolean;
  isActive: boolean;
  current: string | null | undefined;
  today: string;
}): string | null {
  if (input.isActive) return null;
  if (input.wasActive) return input.today;

  return input.current ?? input.today;
}
