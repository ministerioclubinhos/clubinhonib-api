import {
    IsArray,
    IsBoolean,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MediaItemDto } from 'src/share/share-dto/media-item-dto';

export class UpdateSectionDto {
    @IsOptional()
    @IsString({ message: 'O campo "id" da seção deve ser uma string.' })
    id?: string;

    @IsString({ message: 'O campo "caption" da seção deve ser uma string.' })
    caption: string;

    @IsString({ message: 'O campo "description" da seção deve ser uma string.' })
    description: string;

    @IsBoolean({ message: 'O campo "public" da seção deve ser booleano.' })
    public: boolean;

    @IsArray({ message: 'O campo "mediaItems" deve ser um array.' })
    @ValidateNested({ each: true })
    @Type(() => MediaItemDto)
    mediaItems: MediaItemDto[];
}

export class UpdateImagePageDto {

    @IsString({ message: 'O campo "id" da galeria deve ser uma string.' })
    id: string;

    @IsString({ message: 'O campo "title" da galeria deve ser uma string.' })
    title: string;

    @IsString({ message: 'O campo "description" da galeria deve ser uma string.' })
    description: string;

    @IsBoolean({ message: 'O campo "public" da galeria deve ser booleano.' })
    public: boolean;

    @IsArray({ message: 'O campo "sections" deve ser um array.' })
    @ValidateNested({ each: true })
    @Type(() => UpdateSectionDto)
    sections: UpdateSectionDto[];
}
