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
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';
import { Paginated } from 'src/shared/dto/paginated.dto';

import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { QueryCommentsDto } from './dto/query-comments.dto';
import { CommentResponseDto } from './dto/comment-response.dto';
import { CreateCommentService } from './services/create-comment.service';
import { GetCommentsService } from './services/get-comments.service';
import { UpdateCommentService } from './services/update-comment.service';
import { DeleteCommentService } from './services/delete-comment.service';

@Controller('comments')
export class CommentController {
  private readonly logger = new Logger(CommentController.name);

  constructor(
    private readonly createService: CreateCommentService,
    private readonly getService: GetCommentsService,
    private readonly updateService: UpdateCommentService,
    private readonly deleteService: DeleteCommentService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateCommentDto): Promise<CommentResponseDto> {
    this.logger.debug('POST /comments');
    return this.createService.create(dto);
  }

  /** Página inicial do site; sem autenticação. */
  @Get('published')
  async findPublished(): Promise<CommentResponseDto[]> {
    return this.getService.findPublished();
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async findAllPaginated(
    @Query() query: QueryCommentsDto,
  ): Promise<Paginated<CommentResponseDto>> {
    this.logger.debug('GET /comments');
    return this.getService.findAllPaginated(query);
  }

  @Get('unpublished-count')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async countUnpublished(): Promise<{ unpublished: number }> {
    return this.getService.countUnpublished();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CommentResponseDto> {
    return this.getService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommentDto,
  ): Promise<CommentResponseDto> {
    this.logger.debug(`PUT /comments/${id}`);
    return this.updateService.update(id, dto);
  }

  @Patch(':id/publish')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CommentResponseDto> {
    this.logger.debug(`PATCH /comments/${id}/publish`);
    return this.updateService.setPublished(id, true);
  }

  @Patch(':id/unpublish')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async unpublish(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CommentResponseDto> {
    this.logger.debug(`PATCH /comments/${id}/unpublish`);
    return this.updateService.setPublished(id, false);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    this.logger.debug(`DELETE /comments/${id}`);
    return this.deleteService.remove(id);
  }
}
