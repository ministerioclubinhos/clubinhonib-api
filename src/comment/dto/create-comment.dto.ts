import { IsString } from 'class-validator';

export class CreateCommentDto {
  @IsString({ message: 'name deve ser uma string' })
  name: string;

  @IsString({ message: 'comment deve ser uma string' })
  comment: string;

  @IsString({ message: 'clubinho deve ser uma string' })
  clubinho: string;

  @IsString({ message: 'neighborhood deve ser uma string' })
  neighborhood: string;
}
