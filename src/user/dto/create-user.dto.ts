import { UserRole } from "../user.entity";
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";

export class CreateUserDto {
  @IsString() name!: string;
  @IsEmail() email!: string;
  @MinLength(6) password!: string;
  @IsString() phone!: string;
  @IsOptional() @IsEnum(UserRole)
  role?: UserRole;
  @IsOptional() completed?: boolean;
  @IsOptional() commonUser?: boolean;
  @IsOptional() active?: boolean;
}
