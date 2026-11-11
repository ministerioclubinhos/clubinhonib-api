import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { AuditOutcome } from 'src/core/audit/enums';
import { UserRole } from 'src/core/auth/auth.types';
import { LogSourceType } from 'src/shared/providers/log-storage/enums';

import {
  LOG_RECORDS_ACTOR_NAME_MAX_LENGTH,
  LOG_RECORDS_ACTOR_NAME_MIN_LENGTH,
  LOG_RECORDS_TEXT_FILTER_MAX_LENGTH,
} from '../constants';
import { QueryLogRecordsDto } from './query-log-records.dto';

export class QueryAuditRecordsDto extends QueryLogRecordsDto {
  @IsOptional()
  @IsUUID()
  actorId?: string;

  /** Trecho do nome do usuário, sem diferenciar maiúsculas ou acentos. */
  @IsOptional()
  @IsString()
  @MinLength(LOG_RECORDS_ACTOR_NAME_MIN_LENGTH)
  @MaxLength(LOG_RECORDS_ACTOR_NAME_MAX_LENGTH)
  actorName?: string;

  @IsOptional()
  @IsEnum(UserRole)
  actorRole?: UserRole;

  @IsOptional()
  @IsEnum(AuditOutcome)
  outcome?: AuditOutcome;

  /** Trecho do identificador, ex.: `ClubsController` ou `.create`. */
  @IsOptional()
  @IsString()
  @MaxLength(LOG_RECORDS_TEXT_FILTER_MAX_LENGTH)
  @Matches(/^[A-Za-z0-9_.:/ -]+$/)
  actionName?: string;

  @IsOptional()
  @IsEnum(LogSourceType)
  sourceType?: LogSourceType;
}
