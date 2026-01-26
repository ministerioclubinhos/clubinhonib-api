import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * DTO para o usuário atualizar seu próprio perfil
 * Permite alterar apenas: name, email, phone
 */
export class UpdateOwnProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'O nome deve ter pelo menos 2 caracteres' })
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'O email deve ser um endereço de email válido' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'O telefone deve ser uma string' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'O CPF deve ser uma string' })
  cpf?: string;
}
