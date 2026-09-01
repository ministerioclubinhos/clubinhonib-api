import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { WeekMaterialsPageMediaDto } from './week-material-media.dto';

/** Request contract of `POST /week-material-pages`. */
export class CreateWeekMaterialsPageDto extends WeekMaterialsPageMediaDto {
  @IsString({ message: 'O campo "pageTitle" deve ser uma string.' })
  pageTitle: string;

  @IsString({ message: 'O campo "pageSubtitle" deve ser uma string.' })
  pageSubtitle: string;

  @IsString({ message: 'O campo "pageDescription" deve ser uma string.' })
  pageDescription: string;

  /**
   * Accepted for compatibility with the admin form, but never applied: a page
   * is published only through `POST /week-material-pages/current-week/:id`.
   */
  @IsOptional()
  @IsBoolean({ message: 'O campo "currentWeek" deve ser um boolean.' })
  currentWeek?: boolean;
}
