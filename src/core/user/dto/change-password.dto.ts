import { IsString, MinLength, IsOptional } from 'class-validator';

/**
 * DTO para alteração de senha
 * - currentPassword: obrigatório apenas para commonUser = true
 * - newPassword: sempre obrigatório
 */
export class ChangePasswordDto {
  @IsOptional()
  @IsString({ message: 'A senha atual deve ser uma string' })
  currentPassword?: string;

  @IsString({ message: 'A nova senha é obrigatória' })
  @MinLength(6, { message: 'A nova senha deve ter pelo menos 6 caracteres' })
  newPassword: string;
}

