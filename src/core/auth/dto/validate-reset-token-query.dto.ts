import { IsNotEmpty, IsString } from 'class-validator';

/** Query de `GET /auth/reset-password/validate`. */
export class ValidateResetTokenQueryDto {
  @IsString({ message: 'O token deve ser uma string.' })
  @IsNotEmpty({ message: 'O token é obrigatório.' })
  token: string;
}
