import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';

import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';

import { CreateVideosPageDto } from './dto/create-videos-page.dto';
import { UpdateVideosPageDto } from './dto/update-videos-page.dto';
import { VideosPageResponseDto } from './dto/videos-page-response.dto';
import { CreateVideosPageService } from './services/create-video-page.service';
import { UpdateVideosPageService } from './services/update-video-page.service';
import { GetVideosPageService } from './services/get-video-page.service';
import { DeleteVideosPageService } from './services/delete-video-page.service';
import { buildFilesDict, parseAndValidatePayload } from './utils';
import { VIDEO_PAGE_PAYLOAD_FIELD } from './constants';

@Controller('video-pages')
export class VideosPageController {
  private readonly logger = new Logger(VideosPageController.name);

  constructor(
    private readonly createService: CreateVideosPageService,
    private readonly updateService: UpdateVideosPageService,
    private readonly getService: GetVideosPageService,
    private readonly deleteService: DeleteVideosPageService,
  ) {}

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body(VIDEO_PAGE_PAYLOAD_FIELD) raw: string,
  ): Promise<VideosPageResponseDto> {
    this.logger.debug('POST /video-pages');

    const dto = await parseAndValidatePayload(raw, CreateVideosPageDto);

    return this.createService.execute(dto, buildFilesDict(files));
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body(VIDEO_PAGE_PAYLOAD_FIELD) raw: string,
  ): Promise<VideosPageResponseDto> {
    this.logger.debug(`PATCH /video-pages/${id}`);

    const dto = await parseAndValidatePayload(raw, UpdateVideosPageDto);

    return this.updateService.execute(id, dto, buildFilesDict(files));
  }

  @Get()
  async findAll(): Promise<VideosPageResponseDto[]> {
    this.logger.debug('GET /video-pages');
    return this.getService.findAll();
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VideosPageResponseDto> {
    this.logger.debug(`GET /video-pages/${id}`);
    return this.getService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    this.logger.debug(`DELETE /video-pages/${id}`);
    await this.deleteService.execute(id);
  }
}
