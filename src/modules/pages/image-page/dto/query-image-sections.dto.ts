import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  IMAGE_SECTIONS_DEFAULT_LIMIT,
  IMAGE_SECTIONS_DEFAULT_PAGE,
  IMAGE_SECTIONS_MAX_LIMIT,
} from '../constants';

/** Contrato de query de `GET /image-pages/:id/sections`. */
export class QueryImageSectionsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'O campo "page" deve ser um número inteiro.' })
  @Min(1, { message: 'O campo "page" deve ser maior ou igual a 1.' })
  page: number = IMAGE_SECTIONS_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'O campo "limit" deve ser um número inteiro.' })
  @Min(1, { message: 'O campo "limit" deve ser maior ou igual a 1.' })
  @Max(IMAGE_SECTIONS_MAX_LIMIT, {
    message: `O campo "limit" não pode ser maior que ${IMAGE_SECTIONS_MAX_LIMIT}.`,
  })
  limit: number = IMAGE_SECTIONS_DEFAULT_LIMIT;
}
