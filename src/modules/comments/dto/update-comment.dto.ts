import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

import {
  COMMENT_CLUBINHO_MAX_LENGTH,
  COMMENT_NAME_MAX_LENGTH,
  COMMENT_NEIGHBORHOOD_MAX_LENGTH,
  COMMENT_TEXT_MAX_LENGTH,
} from '../constants';

/**
 * Edição de comentário.
 *
 * Todo campo é opcional: dá para alterar só o que mudou. Na versão anterior os
 * quatro campos de texto eram obrigatórios e `published` era validado como
 * texto — então tanto publicar quanto editar um comentário respondiam 400.
 */
export class UpdateCommentDto {
  @IsOptional()
  @IsString()
  @MaxLength(COMMENT_NAME_MAX_LENGTH)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(COMMENT_TEXT_MAX_LENGTH)
  comment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(COMMENT_CLUBINHO_MAX_LENGTH)
  clubinho?: string;

  @IsOptional()
  @IsString()
  @MaxLength(COMMENT_NEIGHBORHOOD_MAX_LENGTH)
  neighborhood?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
