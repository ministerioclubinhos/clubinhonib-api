import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  NOTIFICATIONS_DEFAULT_LIMIT,
  NOTIFICATIONS_DEFAULT_PAGE,
  NOTIFICATIONS_MAX_LIMIT,
} from '../constants';
import { NotificationStatusFilter, NotificationType } from '../types';

export class QueryNotificationsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = NOTIFICATIONS_DEFAULT_PAGE;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(NOTIFICATIONS_MAX_LIMIT)
  limit: number = NOTIFICATIONS_DEFAULT_LIMIT;

  @IsOptional()
  @IsEnum(NotificationStatusFilter)
  status: NotificationStatusFilter = NotificationStatusFilter.ALL;

  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;
}
