import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

import {
  LOG_RECORDS_DEFAULT_LIMIT,
  LOG_RECORDS_DEFAULT_PAGE,
  LOG_RECORDS_MAX_LIMIT,
} from '../constants';

/** Parâmetros comuns às duas consultas. `from`/`to` são obrigatórios. */
export class QueryLogRecordsDto {
  @IsISO8601({ strict: true })
  from!: string;

  @IsISO8601({ strict: true })
  to!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = LOG_RECORDS_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LOG_RECORDS_MAX_LIMIT)
  limit?: number = LOG_RECORDS_DEFAULT_LIMIT;

  @IsOptional()
  @IsUUID()
  requestId?: string;
}
