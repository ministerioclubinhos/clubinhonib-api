import { IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DocumentMediaDto } from './document-media.dto';

export class CreateDocumentDto {
  @IsString({ message: 'name deve ser uma string' })
  name: string;

  @IsOptional()
  @IsString({ message: 'description deve ser uma string' })
  description?: string;

  @ValidateNested()
  @Type(() => DocumentMediaDto)
  media: DocumentMediaDto;
}
