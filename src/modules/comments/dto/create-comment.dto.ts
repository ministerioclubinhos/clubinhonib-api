import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

import {
  COMMENT_CLUBINHO_MAX_LENGTH,
  COMMENT_NAME_MAX_LENGTH,
  COMMENT_NEIGHBORHOOD_MAX_LENGTH,
  COMMENT_TEXT_MAX_LENGTH,
} from '../constants';

export class CreateCommentDto {
  @IsNotEmpty({ message: 'O nome é obrigatório.' })
  @IsString()
  @MaxLength(COMMENT_NAME_MAX_LENGTH)
  name: string;

  @IsNotEmpty({ message: 'O comentário é obrigatório.' })
  @IsString()
  @MaxLength(COMMENT_TEXT_MAX_LENGTH)
  comment: string;

  @IsNotEmpty({ message: 'O clubinho é obrigatório.' })
  @IsString()
  @MaxLength(COMMENT_CLUBINHO_MAX_LENGTH)
  clubinho: string;

  @IsNotEmpty({ message: 'O bairro é obrigatório.' })
  @IsString()
  @MaxLength(COMMENT_NEIGHBORHOOD_MAX_LENGTH)
  neighborhood: string;
}
