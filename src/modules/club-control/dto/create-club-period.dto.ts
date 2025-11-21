import { IsNotEmpty, IsInt, Min, Max, IsString, IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para criar Período Letivo GLOBAL
 * Um único período por ano, válido para todos os clubes
 * 
 * Exemplo:
 * {
 *   "year": 2024,
 *   "startDate": "2024-02-05",
 *   "endDate": "2024-12-15",
 *   "description": "Ano Letivo 2024"
 * }
 */
export class CreateClubPeriodDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number; // Ano letivo (ex: 2024)

  @IsNotEmpty()
  @IsString()
  startDate: string; // YYYY-MM-DD - Data de início do ano letivo

  @IsNotEmpty()
  @IsString()
  endDate: string; // YYYY-MM-DD - Data de fim do ano letivo

  @IsOptional()
  @IsString()
  description?: string; // Ex: "Ano Letivo 2024"

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
