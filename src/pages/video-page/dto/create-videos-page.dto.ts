import {
    IsArray,
    IsBoolean,
    IsString,
    ValidateNested,
  } from 'class-validator';
  import { Type } from 'class-transformer';
import { MediaItemDto } from 'src/share/share-dto/media-item-dto';

  
  export class CreateVideosPageDto {
    @IsString({ message: 'O campo "title" da página deve ser uma string.' })
    title: string;
  
    @IsString({ message: 'O campo "description" da página deve ser uma string.' })
    description: string;
  
    @IsBoolean({ message: 'O campo "public" da página deve ser booleano.' })
    public: boolean;
  
    @IsArray({ message: 'O campo "videos" deve ser um array.' })
    @ValidateNested({ each: true })
    @Type(() => MediaItemDto)
    videos: MediaItemDto[];
  }