import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
    @IsNotEmpty()
    @IsString()
    token: string;

    @IsNotEmpty()
    @MinLength(6, { message: 'A senha deve ter pelo menos 6 caracteres' })
    newPassword: string;
}
