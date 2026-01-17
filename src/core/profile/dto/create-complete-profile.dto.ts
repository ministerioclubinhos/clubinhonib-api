import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreatePersonalDataDto } from './create-personal-data.dto';
import { CreateUserPreferencesDto } from './create-user-preferences.dto';

export class CreateCompleteProfileDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePersonalDataDto)
  personalData?: CreatePersonalDataDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateUserPreferencesDto)
  preferences?: CreateUserPreferencesDto;
}
