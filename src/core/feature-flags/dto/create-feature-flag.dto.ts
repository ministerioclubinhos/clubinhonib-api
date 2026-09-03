import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import { UserRole } from 'src/core/auth/auth.types';

/**
 * A chave é usada em código e em URL.
 *
 * Só minúsculas, números e `_`. O hífen fica de fora de propósito: com as duas
 * formas circulando, a mesma flag acabava escrita de dois jeitos.
 */
const KEY_PATTERN = /^[a-z0-9][a-z0-9_]*$/;

export class CreateFeatureFlagDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsString()
  @MaxLength(255)
  @Matches(KEY_PATTERN, {
    message:
      'A chave deve conter apenas letras minúsculas, números e "_", começando por letra ou número.',
  })
  key: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  /**
   * Perfis que enxergam a flag. Lista vazia significa todos, inclusive quem
   * não fez login.
   */
  @IsArray()
  @IsEnum(UserRole, {
    each: true,
    message: 'Cada perfil deve ser "admin", "coordinator" ou "teacher".',
  })
  @IsOptional()
  targetRoles?: UserRole[];

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
