import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';
import { AuthRequest } from 'src/core/auth/auth.types';
import { Paginated } from 'src/shared/dto/paginated.dto';

import { CreateSiteFeedbackDto } from './dto/create-site-feedback.dto';
import { UpdateSiteFeedbackDto } from './dto/update-site-feedback.dto';
import { QueryFeedbacksDto } from './dto/query-feedbacks.dto';
import { SiteFeedbackResponseDto } from './dto/site-feedback-response.dto';
import { CreateFeedbackService } from './services/create-feedback.service';
import { GetFeedbacksService } from './services/get-feedbacks.service';
import { UpdateFeedbackService } from './services/update-feedback.service';
import { DeleteFeedbackService } from './services/delete-feedback.service';

@Controller('site-feedbacks')
export class SiteFeedbackController {
  private readonly logger = new Logger(SiteFeedbackController.name);

  constructor(
    private readonly createService: CreateFeedbackService,
    private readonly getService: GetFeedbacksService,
    private readonly updateService: UpdateFeedbackService,
    private readonly deleteService: DeleteFeedbackService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() dto: CreateSiteFeedbackDto,
    @Request() req: AuthRequest,
  ): Promise<SiteFeedbackResponseDto> {
    this.logger.debug('POST /site-feedbacks');
    // O autor vem do token: nome e e-mail não são aceitos no corpo.
    return this.createService.create(dto, req.user.userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async findAllPaginated(
    @Query() query: QueryFeedbacksDto,
  ): Promise<Paginated<SiteFeedbackResponseDto>> {
    this.logger.debug('GET /site-feedbacks');
    return this.getService.findAllPaginated(query);
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async countUnread(): Promise<{ unread: number }> {
    return this.getService.countUnread();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SiteFeedbackResponseDto> {
    return this.getService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSiteFeedbackDto,
  ): Promise<SiteFeedbackResponseDto> {
    this.logger.debug(`PUT /site-feedbacks/${id}`);
    return this.updateService.update(id, dto);
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async setRead(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SiteFeedbackResponseDto> {
    this.logger.debug(`PATCH /site-feedbacks/${id}/read`);
    return this.updateService.setRead(id, true);
  }

  @Patch(':id/unread')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async setUnread(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SiteFeedbackResponseDto> {
    this.logger.debug(`PATCH /site-feedbacks/${id}/unread`);
    return this.updateService.setRead(id, false);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    this.logger.debug(`DELETE /site-feedbacks/${id}`);
    return this.deleteService.remove(id);
  }
}
