import { IsOptional, IsString } from 'class-validator';

/**
 * Endereço do clubinho na entrada.
 *
 * Criação e edição usam o mesmo formato: todos os campos são opcionais e o que
 * vier é gravado por cima do que já existe.
 */
export class ClubAddressInputDto {
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() complement?: string;
}
