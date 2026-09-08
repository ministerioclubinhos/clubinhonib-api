import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/**
 * Filtros do resumo semanal.
 *
 * Sem `year` o resumo responde pelo ano letivo corrente. `clubId` recorta um
 * clubinho do conjunto que quem pediu já enxerga — nunca amplia o alcance:
 * um clubinho de outro coordenador simplesmente não está no conjunto.
 */
export class ClubWeeklySummaryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsUUID()
  clubId?: string;
}
