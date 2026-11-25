import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PlayScope } from '../enums/play-scope.enum';

/** Como a galeria participa do Clubinho Play. */
export class PlayConfigDto {
  @IsEnum(PlayScope, {
    message: 'O campo "scope" deve ser "none", "all" ou "selected".',
  })
  scope: PlayScope;

  /** Categoria da galeria; `null` remove; ausente mantém. */
  @IsOptional()
  @IsUUID('all', {
    message: 'O campo "categoryId" deve ser um identificador válido.',
  })
  categoryId?: string | null;
}
