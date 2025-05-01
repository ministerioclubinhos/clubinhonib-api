import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MediaItemDto } from 'src/share/share-dto/media-item-dto';

export class UpdateEventDto {
  @IsOptional()
  @IsString({ message: 'id deve ser uma string' })
  id?: string;

  @IsOptional()
  @IsString({ message: 'title deve ser uma string' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'description deve ser uma string' })
  description?: string;

  @IsOptional()
  @IsDateString({}, { message: 'date deve estar em formato ISO válido (YYYY-MM-DD)' })
  date?: string;

  @IsOptional()
  @IsString({ message: 'location deve ser uma string' })
  location?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MediaItemDto)
  media?: MediaItemDto;

  @IsOptional()
  @IsBoolean({ message: 'isLocalFile deve ser um valor booleano (true ou false)' })
  isLocalFile?: boolean;
}
