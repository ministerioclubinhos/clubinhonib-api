import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '../auth.types';

export class CompleteUserDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => String(value).trim())
  name: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => String(value).trim())
  phone: string;

  @IsOptional()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsIn([UserRole.TEACHER, UserRole.COORDINATOR])
  role?: UserRole;
}
