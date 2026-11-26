import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '../auth.types';
import {
  SELF_REGISTRATION_ROLE_MESSAGE,
  SELF_REGISTRATION_ROLES,
} from '../constants';

export class RegisterUserDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => String(value).trim())
  name: string;

  @IsEmail()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => String(value).trim())
  phone: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsIn(SELF_REGISTRATION_ROLES, { message: SELF_REGISTRATION_ROLE_MESSAGE })
  role: UserRole;
}
