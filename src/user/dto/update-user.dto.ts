import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { UserRole } from "../user.entity";

export class UpdateUserDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @MinLength(6) password?: string;
  @IsOptional() @IsString() phone?: string;

  @IsOptional() @IsEnum(UserRole)
  role?: UserRole;

  // flags seguem opcionais (você pode permitir ajustes finos se desejar)
  @IsOptional() completed?: boolean;
  @IsOptional() commonUser?: boolean;
  @IsOptional() active?: boolean;
}
