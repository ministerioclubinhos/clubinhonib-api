import { IsString, IsBoolean, IsOptional } from 'class-validator';

/**
 * DTO para atualizar Período Letivo GLOBAL
 *
 * Exemplo:
 * {
 *   "startDate": "2024-02-05",
 *   "endDate": "2024-12-15",
 *   "description": "Ano Letivo 2024",
 *   "isActive": true
 * }
 *
 * NOTA: O campo `year` não pode ser alterado (é único e identifica o período)
 */
export class UpdateClubPeriodDto {
  @IsOptional()
  @IsString()
  startDate?: string; // YYYY-MM-DD - Data de início do ano letivo

  @IsOptional()
  @IsString()
  endDate?: string; // YYYY-MM-DD - Data de fim do ano letivo

  @IsOptional()
  @IsString()
  description?: string; // Ex: "Ano Letivo 2024"

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
