import { IsOptional, IsString } from 'class-validator';

export class CreateUserPreferencesDto {
  @IsOptional()
  @IsString()
  loveLanguages?: string;

  @IsOptional()
  @IsString()
  temperaments?: string;

  @IsOptional()
  @IsString()
  favoriteColor?: string;

  @IsOptional()
  @IsString()
  favoriteFood?: string;

  @IsOptional()
  @IsString()
  favoriteMusic?: string;

  @IsOptional()
  @IsString()
  whatMakesYouSmile?: string;

  @IsOptional()
  @IsString()
  skillsAndTalents?: string;
}
