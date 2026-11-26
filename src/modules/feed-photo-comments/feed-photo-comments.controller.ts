import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthRequest } from 'src/core/auth/auth.types';
import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';
import { AuthContextService } from 'src/core/auth/services/auth-context.service';
import { Paginated } from 'src/shared/dto/paginated.dto';
import { CreatePhotoCommentDto } from './dto/create-photo-comment.dto';
import { ModeratePhotoCommentDto } from './dto/moderate-photo-comment.dto';
import {
  AdminPhotoCommentResponseDto,
  OwnPhotoCommentResponseDto,
  PhotoCommentDeletedDto,
  PhotoCommentResponseDto,
} from './dto/photo-comment-response.dto';
import {
  QueryPhotoCommentModerationDto,
  QueryPhotoCommentsDto,
} from './dto/query-photo-comments.dto';
import { CreateFeedPhotoCommentService } from './services/create-feed-photo-comment.service';
import { DeleteFeedPhotoCommentService } from './services/delete-feed-photo-comment.service';
import { GetFeedPhotoCommentsService } from './services/get-feed-photo-comments.service';
import { UpdateFeedPhotoCommentService } from './services/update-feed-photo-comment.service';
import { GetPhotoCommentNotificationsService } from './services/get-photo-comment-notifications.service';
import { UpdatePhotoCommentNotificationsService } from './services/update-photo-comment-notifications.service';
import {
  PhotoCommentNotificationDto,
  PhotoCommentNotificationsPageDto,
} from './dto/photo-comment-notification.dto';

@Controller('feed-photo-comments')
export class FeedPhotoCommentsController {
  constructor(
    private readonly createService: CreateFeedPhotoCommentService,
    private readonly getService: GetFeedPhotoCommentsService,
    private readonly updateService: UpdateFeedPhotoCommentService,
    private readonly deleteService: DeleteFeedPhotoCommentService,
    private readonly auth: AuthContextService,
    private readonly getNotifications: GetPhotoCommentNotificationsService,
    private readonly updateNotifications: UpdatePhotoCommentNotificationsService,
  ) {}

  @Get('notifications')
  @UseGuards(JwtAuthGuard)
  async notifications(
    @Query() query: QueryPhotoCommentsDto,
    @Req() request: AuthRequest,
  ): Promise<PhotoCommentNotificationsPageDto> {
    return this.getNotifications.findMine(query, request.user.userId);
  }

  @Patch('notifications/:id/read')
  @UseGuards(JwtAuthGuard)
  async readNotification(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthRequest,
  ): Promise<PhotoCommentNotificationDto> {
    return this.updateNotifications.markRead(id, request.user.userId);
  }

  @Get('photos/:mediaId')
  async published(
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @Query() query: QueryPhotoCommentsDto,
    @Req() request: Request,
  ): Promise<Paginated<PhotoCommentResponseDto>> {
    return this.getService.findPublished(
      mediaId,
      query,
      await this.auth.resolveAccessContext(request),
    );
  }

  @Get('photos/:mediaId/mine')
  @UseGuards(JwtAuthGuard)
  async mine(
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @Query() query: QueryPhotoCommentsDto,
    @Req() request: AuthRequest,
  ): Promise<Paginated<OwnPhotoCommentResponseDto>> {
    return this.getService.findMine(mediaId, query, request.user.userId);
  }

  @Post('photos/:mediaId')
  @UseGuards(JwtAuthGuard)
  async create(
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @Body() dto: CreatePhotoCommentDto,
    @Req() request: AuthRequest,
  ): Promise<OwnPhotoCommentResponseDto> {
    return this.createService.create(mediaId, dto, request.user.userId);
  }

  @Get('moderation')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async moderation(
    @Query() query: QueryPhotoCommentModerationDto,
    @Req() request: AuthRequest,
  ): Promise<Paginated<AdminPhotoCommentResponseDto>> {
    return this.getService.findModeration(query, request.user.userId);
  }

  @Patch(':id/moderation')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async moderate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModeratePhotoCommentDto,
    @Req() request: AuthRequest,
  ): Promise<OwnPhotoCommentResponseDto> {
    return this.updateService.moderate(id, dto, request.user.userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthRequest,
  ): Promise<PhotoCommentDeletedDto> {
    return this.deleteService.remove(id, request.user.userId);
  }
}
