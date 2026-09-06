import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

import { AuditOutcome } from 'src/core/audit/enums';
import { UserRole } from 'src/core/auth/auth.types';
import { LogSourceType } from 'src/shared/providers/log-storage/enums';

import { LOG_RECORDS_TEXT_FILTER_MAX_LENGTH } from '../constants';
import { QueryLogRecordsDto } from './query-log-records.dto';

export class QueryAuditRecordsDto extends QueryLogRecordsDto {
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsOptional()
  @IsEnum(UserRole)
  actorRole?: UserRole;

  @IsOptional()
  @IsEnum(AuditOutcome)
  outcome?: AuditOutcome;

  /** Identificador exato, ex.: `ClubsModule.ClubsController.create`. */
  @IsOptional()
  @IsString()
  @MaxLength(LOG_RECORDS_TEXT_FILTER_MAX_LENGTH)
  @Matches(/^[A-Za-z0-9_.:/ -]+$/)
  actionName?: string;

  @IsOptional()
  @IsEnum(LogSourceType)
  sourceType?: LogSourceType;
}
