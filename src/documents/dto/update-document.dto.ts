import {
  IsString,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MediaItemDto } from 'src/share/share-dto/media-item-dto';

export class UpdateDocumentDto {
  @IsString({ message: 'id deve ser uma string' })
  id: string;

  @IsString({ message: 'name deve ser uma string' })
  name: string;

  @IsOptional()
  @IsString({ message: 'description deve ser uma string' })
  description?: string;

  @ValidateNested()
  @Type(() => MediaItemDto)
  media: MediaItemDto;
}
