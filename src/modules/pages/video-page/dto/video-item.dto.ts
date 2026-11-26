import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import {
  PLAY_MAX_DURATION_SECONDS,
  PLAY_MAX_POSITION,
} from 'src/modules/play/constants';

/** Vídeo da galeria: a mídia comum mais os atributos do Clubinho Play. */
export class VideoItemDto extends MediaItemDto {
  @IsOptional()
  @IsBoolean({ message: 'O campo "inPlay" deve ser booleano.' })
  inPlay?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'O campo "featured" deve ser booleano.' })
  featured?: boolean;

  @IsOptional()
  @IsInt({ message: 'O campo "position" deve ser um número inteiro.' })
  @Min(0, { message: 'A posição não pode ser negativa.' })
  @Max(PLAY_MAX_POSITION, {
    message: `A posição deve ser no máximo ${PLAY_MAX_POSITION}.`,
  })
  position?: number;

  /** Campo multipart com a miniatura (imagem) deste vídeo no Play. */
  @IsOptional()
  @IsString({ message: 'O campo "thumbnailField" deve ser uma string.' })
  thumbnailField?: string;

  /** Duração em segundos, lida no navegador do admin. */
  @IsOptional()
  @IsInt({ message: 'O campo "durationSeconds" deve ser um número inteiro.' })
  @Min(0)
  @Max(PLAY_MAX_DURATION_SECONDS)
  durationSeconds?: number;
}
