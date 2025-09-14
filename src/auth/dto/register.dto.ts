import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '../auth.types';

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

  @IsEnum(UserRole)
  role: UserRole;
}
