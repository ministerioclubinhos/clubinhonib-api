import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { WeekMaterialsPageMediaDto } from './week-material-media.dto';

/**
 * Request contract of `PATCH /week-material-pages/:id`.
 *
 * `id` is accepted for backward compatibility with the admin form, but the page
 * updated is always the one identified by the route parameter.
 */
export class UpdateWeekMaterialsPageDto extends WeekMaterialsPageMediaDto {
  @IsOptional()
  @IsString({ message: 'O campo "id" da página deve ser uma string.' })
  id?: string;

  @IsString({ message: 'O campo "pageTitle" da página deve ser uma string.' })
  pageTitle: string;

  @IsString({
    message: 'O campo "pageSubtitle" da página deve ser uma string.',
  })
  pageSubtitle: string;

  @IsString({
    message: 'O campo "pageDescription" da página deve ser uma string.',
  })
  pageDescription: string;

  @IsOptional()
  @IsBoolean({
    message: 'O campo "currentWeek" da página deve ser um boolean.',
  })
  currentWeek?: boolean;
}
