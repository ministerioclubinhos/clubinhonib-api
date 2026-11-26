import { ArrayMinSize, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsString,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';

export class UpdateImageSectionDto {
  @IsString({ message: 'O campo "caption" deve ser uma string.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(1)
  @MaxLength(255)
  caption: string;

  @IsString({ message: 'O campo "description" deve ser uma string.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(1)
  description: string;

  @IsOptional()
  @IsBoolean({ message: 'O campo "public" deve ser booleano.' })
  @Type(() => Boolean)
  public: boolean = false;

  @IsArray({ message: 'O campo "mediaItems" deve ser um array.' })
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  mediaItems: MediaItemDto[];
}
