import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UserRole } from '../auth.types';
import {
  SELF_REGISTRATION_ROLE_MESSAGE,
  SELF_REGISTRATION_ROLES,
} from '../constants';

export class CompleteUserDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsOptional()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsIn(SELF_REGISTRATION_ROLES, { message: SELF_REGISTRATION_ROLE_MESSAGE })
  role?: UserRole;

  /** Emitido por `/auth/google` quando o cadastro ainda está incompleto. */
  @IsString()
  @IsNotEmpty()
  registrationToken: string;
}
