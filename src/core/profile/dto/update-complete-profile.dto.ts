import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdatePersonalDataDto } from './update-personal-data.dto';
import { UpdateUserPreferencesDto } from './update-user-preferences.dto';

export class UpdateCompleteProfileDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePersonalDataDto)
  personalData?: UpdatePersonalDataDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateUserPreferencesDto)
  preferences?: UpdateUserPreferencesDto;
}
