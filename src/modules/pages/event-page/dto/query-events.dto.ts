import { IsISO8601, IsOptional } from 'class-validator';

/**
 * Recorte de datas da agenda.
 *
 * Existe porque um encontro de clubinho devolve uma data por semana de período
 * letivo: com os períodos de alguns anos cadastrados, cada clubinho passa a
 * carregar centenas de datas em toda chamada. Quem só desenha um mês pede o mês.
 *
 * Sem os parâmetros o comportamento é o de antes — a agenda inteira —, então
 * nenhum cliente existente precisa mudar.
 */
export class QueryEventsDto {
  /** Primeira data devolvida, em `YYYY-MM-DD`. */
  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'from deve ser uma data válida.' })
  from?: string;

  /** Última data devolvida, em `YYYY-MM-DD`. */
  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'to deve ser uma data válida.' })
  to?: string;
}
