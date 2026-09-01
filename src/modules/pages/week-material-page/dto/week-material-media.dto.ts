import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';

/** Media arrays shared by the create and update contracts of a week material page. */
export class WeekMaterialsPageMediaDto {
  @IsOptional()
  @IsArray({ message: 'O campo "videos" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  videos?: MediaItemDto[];

  @IsOptional()
  @IsArray({ message: 'O campo "documents" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  documents?: MediaItemDto[];

  @IsOptional()
  @IsArray({ message: 'O campo "images" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  images?: MediaItemDto[];

  @IsOptional()
  @IsArray({ message: 'O campo "audios" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  audios?: MediaItemDto[];
}
