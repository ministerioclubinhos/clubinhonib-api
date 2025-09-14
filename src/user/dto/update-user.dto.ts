import { IsEmail, IsEnum, IsOptional, IsString, MinLength, IsBoolean } from "class-validator";
import { UserRole } from "src/auth/auth.types";

export class UpdateUserDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @MinLength(6)
  password?: string;

  @IsOptional() @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional() @IsBoolean()
  completed?: boolean;

  @IsOptional() @IsBoolean()
  commonUser?: boolean;

  @IsOptional() @IsBoolean()
  active?: boolean;
}
