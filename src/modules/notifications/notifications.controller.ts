import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthRequest } from 'src/core/auth/auth.types';
import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import {
  NotificationDetailDto,
  NotificationDto,
  NotificationsPageDto,
  NotificationsReadAllDto,
  NotificationSummaryDto,
} from './dto/notification-response.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { GetNotificationsService } from './services/get-notifications.service';
import { UpdateNotificationsService } from './services/update-notifications.service';

@Controller('notifications/me')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly getService: GetNotificationsService,
    private readonly updateService: UpdateNotificationsService,
  ) {}

  @Get('summary')
  async summary(@Req() request: AuthRequest): Promise<NotificationSummaryDto> {
    return this.getService.summary(request.user.userId);
  }

  @Get()
  async list(
    @Query() query: QueryNotificationsDto,
    @Req() request: AuthRequest,
  ): Promise<NotificationsPageDto> {
    return this.getService.list(query, request.user.userId);
  }

  /* Registrada antes das rotas com `:id` para não ser capturada por elas. */
  @Patch('read-all')
  async readAll(@Req() request: AuthRequest): Promise<NotificationsReadAllDto> {
    return this.updateService.markAllRead(request.user.userId);
  }

  @Get(':id')
  async detail(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthRequest,
  ): Promise<NotificationDetailDto> {
    return this.getService.detail(id, request.user.userId);
  }

  @Patch(':id/read')
  async read(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthRequest,
  ): Promise<NotificationDto> {
    return this.updateService.markRead(id, request.user.userId);
  }
}
