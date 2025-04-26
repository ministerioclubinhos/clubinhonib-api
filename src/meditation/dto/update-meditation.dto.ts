import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WeekDay } from '../entities/day.entity';
import { MediaItemDto } from 'src/share/share-dto/media-item-dto';

class UpdateDayDto {
  @IsOptional()
  @IsEnum(WeekDay, {
    message: 'day deve ser um dos valores: Monday, Tuesday, Wednesday, Thursday, Friday',
  })
  day?: WeekDay;

  @IsOptional()
  @IsString({ message: 'verse deve ser uma string' })
  verse?: string;

  @IsOptional()
  @IsString({ message: 'topic deve ser uma string' })
  topic?: string;
}

export class UpdateMeditationDto {
  @IsOptional()
  @IsString({ message: 'id deve ser uma string' })
  id?: string;

  @IsOptional()
  @IsString({ message: 'url deve ser uma string' })
  url?: string;

  @IsOptional()
  @IsString({ message: 'topic deve ser uma string' })
  topic?: string;

  @IsOptional()
  @IsDateString({}, { message: 'startDate deve estar em formato ISO válido (YYYY-MM-DD)' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'endDate deve estar em formato ISO válido (YYYY-MM-DD)' })
  endDate?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MediaItemDto)
  media?: MediaItemDto;
  

  @IsOptional()
  @IsBoolean({ message: 'isLocalFile deve ser um valor booleano (true ou false)' })
  isLocalFile?: boolean;

  @IsOptional()
  @IsArray({ message: 'days deve ser um array' })
  @ArrayMinSize(1, { message: 'days deve conter pelo menos 1 item, se fornecido' })
  @ArrayMaxSize(5, { message: 'days não pode conter mais que 5 itens' })
  @ValidateNested({ each: true })
  @Type(() => UpdateDayDto)
  days?: UpdateDayDto[];
}
