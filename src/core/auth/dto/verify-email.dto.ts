import { IsNotEmpty, IsString, Length } from 'class-validator';
import { AUTH_TOKEN_BYTES } from '../constants';

/** Token hexadecimal recebido no link de confirmação. */
const TOKEN_LENGTH = AUTH_TOKEN_BYTES * 2;

export class VerifyEmailDto {
  @IsNotEmpty({ message: 'O token é obrigatório.' })
  @IsString({ message: 'O token deve ser uma string.' })
  @Length(TOKEN_LENGTH, TOKEN_LENGTH, {
    message: 'Token de confirmação inválido.',
  })
  token: string;
}
