import { IsNotEmpty, IsString, IsEnum, IsBoolean, IsOptional } from 'class-validator';

/**
 * DTO para criar Exceção GLOBAL
 * Uma exceção por data, válida para todos os clubes que funcionam naquele dia da semana
 * 
 * Exemplo:
 * {
 *   "exceptionDate": "2024-11-15",
 *   "reason": "Feriado - Proclamação da República",
 *   "type": "holiday",
 *   "isRecurrent": true
 * }
 * 
 * Se 15/11/2024 cai numa quarta-feira, TODOS os clubes de quarta não funcionam
 */
export class CreateClubExceptionDto {
  @IsNotEmpty()
  @IsString()
  exceptionDate: string; // YYYY-MM-DD - Data da exceção

  @IsNotEmpty()
  @IsString()
  reason: string; // Motivo (ex: "Feriado Nacional", "Recesso")

  @IsOptional()
  @IsEnum(['holiday', 'event', 'maintenance', 'vacation', 'other'])
  type?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isRecurrent?: boolean; // Se repete todo ano (ex: Natal sempre é exceção)
}
