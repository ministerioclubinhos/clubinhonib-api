import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

/**
 * Contrato do formulário público de contato.
 *
 * A rota recebia um tipo inline, que o `ValidationPipe` global ignora por não
 * ser uma classe: o corpo inteiro ia para a entidade, sem validação e sem
 * whitelist — dava para gravar `read: true` ou sobrescrever outro contato pelo
 * `id`, além de aceitar uma mensagem sem limite de tamanho.
 */
export class CreateContactDto {
  @IsNotEmpty({ message: 'O nome é obrigatório.' })
  @IsString({ message: 'O nome deve ser uma string.' })
  @Length(2, 120, { message: 'O nome deve ter entre 2 e 120 caracteres.' })
  name: string;

  @IsNotEmpty({ message: 'O e-mail é obrigatório.' })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @Length(5, 180, { message: 'O e-mail deve ter no máximo 180 caracteres.' })
  email: string;

  @IsNotEmpty({ message: 'O telefone é obrigatório.' })
  @IsString({ message: 'O telefone deve ser uma string.' })
  @Length(8, 20, { message: 'O telefone deve ter entre 8 e 20 caracteres.' })
  phone: string;

  @IsNotEmpty({ message: 'A mensagem é obrigatória.' })
  @IsString({ message: 'A mensagem deve ser uma string.' })
  @Length(10, 2000, {
    message: 'A mensagem deve ter entre 10 e 2000 caracteres.',
  })
  message: string;
}
