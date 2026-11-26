import { IsOptional, IsString } from 'class-validator';

/**
 * Endereço da criança na entrada.
 *
 * O mesmo formato serve para criar e para atualizar: os dois vinham declarados
 * separadamente e já haviam divergido no campo `id`.
 */
export class CreateChildAddressDto {
  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  number?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  complement?: string;
}

export class UpdateChildAddressDto extends CreateChildAddressDto {}
