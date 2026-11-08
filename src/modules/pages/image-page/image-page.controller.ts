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
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';

import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';
import { AuthContextService } from 'src/core/auth/services/auth-context.service';

import { CreateImagePageDto } from './dto/create-image.dto';
import { UpdateImagePageDto } from './dto/update-image.dto';
import { ImagePageResponseDto } from './dto/image-page-response.dto';
import { ImagePageSummaryDto } from './dto/image-page-summary.dto';
import { PaginatedImageSectionResponseDto } from './dto/paginated-image-section.dto';
import { QueryImagePagesDto } from './dto/query-image-pages.dto';
import { Paginated } from 'src/shared/dto/paginated.dto';
import { QueryImageSectionsDto } from './dto/query-image-sections.dto';
import { ImagePageCreateService } from './services/create-image-page.service';
import { ImagePageGetService } from './services/get-image-page.service';
import { ImagePageUpdateService } from './services/update-image-page.service';
import { ImagePageDeleteService } from './services/delete-image-page.service';
import { InjectRepository } from '@nestjs/typeorm';
import { ImageSectionEntity } from './entity/Image-section.entity';
import { ImageSectionCelebrationEntity } from './entity/Image-section-celebration.entity';
import { Repository } from 'typeorm';
import { buildFilesDict, parseAndValidatePayload } from './utils';
import { IMAGE_PAGE_PAYLOAD_FIELD } from './constants';

@Controller('image-pages')
export class ImageController {
  private readonly logger = new Logger(ImageController.name);

  constructor(
    private readonly createService: ImagePageCreateService,
    private readonly deleteService: ImagePageDeleteService,
    private readonly getService: ImagePageGetService,
    private readonly updateService: ImagePageUpdateService,
    private readonly authContext: AuthContextService,
    @InjectRepository(ImageSectionEntity) private readonly sectionRepo: Repository<ImageSectionEntity>,
    @InjectRepository(ImageSectionCelebrationEntity) private readonly celebrationRepo: Repository<ImageSectionCelebrationEntity>,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post(':id/sections/:sectionId/celebrations/toggle')
  async toggleCelebration(@Param('sectionId', ParseUUIDPipe) sectionId: string, @Req() request: Request) {
    const userId = await this.authContext.getUserId(request);
    if (!userId) return { celebrated: false, celebrationCount: 0, celebrators: [] };
    const section = await this.sectionRepo.findOne({ where: { id: sectionId }, relations: { author: true } });
    if (!section) return { celebrated: false, celebrationCount: 0, celebrators: [] };
    if (section.author?.id === userId) return { celebrated: false, celebrationCount: 0, celebrators: [], ownPublication: true };
    const existing = await this.celebrationRepo.findOne({ where: { section: { id: sectionId }, user: { id: userId } } });
    if (existing) await this.celebrationRepo.remove(existing);
    else await this.celebrationRepo.save(this.celebrationRepo.create({ section: { id: sectionId } as ImageSectionEntity, user: { id: userId } as any }));
    const rows = await this.celebrationRepo.find({ where: { section: { id: sectionId } }, relations: { user: true }, order: { createdAt: 'ASC' } });
    return { celebrated: !existing, celebrationCount: rows.length, celebrators: rows.map((row) => row.user.name) };
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body(IMAGE_PAGE_PAYLOAD_FIELD) raw: string,
  ): Promise<ImagePageResponseDto> {
    this.logger.debug('POST /image-pages');

    const dto = await parseAndValidatePayload(raw, CreateImagePageDto);

    return this.createService.createImagePage(dto, buildFilesDict(files));
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body(IMAGE_PAGE_PAYLOAD_FIELD) raw: string,
  ): Promise<ImagePageResponseDto> {
    this.logger.debug(`PATCH /image-pages/${id}`);

    const dto = await parseAndValidatePayload(raw, UpdateImagePageDto);

    return this.updateService.updateImagePage(id, dto, buildFilesDict(files));
  }

  /**
   * Listagem do painel. Exige sessão: é o inventário administrativo das
   * galerias, inclusive das que não estão publicadas.
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @Query() query: QueryImagePagesDto,
  ): Promise<Paginated<ImagePageSummaryDto>> {
    this.logger.debug('GET /image-pages');
    return this.getService.findAllPaginated(query);
  }

  @Get(':id/sections')
  async getPaginatedSections(
    @Param('id', ParseUUIDPipe) pageId: string,
    @Query() query: QueryImageSectionsDto,
    @Req() request: Request,
  ): Promise<PaginatedImageSectionResponseDto> {
    this.logger.debug(`GET /image-pages/${pageId}/sections`);

    // Ler a sessão é transporte; a regra de visibilidade fica no caso de uso,
    // que recebe apenas o booleano.
    const includePrivate = await this.authContext.isLoggedIn(request);
    const currentUserId = await this.authContext.getUserId(request);

    return this.getService.findSectionsPaginated(pageId, query, includePrivate, currentUserId);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ImagePageResponseDto> {
    this.logger.debug(`GET /image-pages/${id}`);
    return this.getService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    this.logger.debug(`DELETE /image-pages/${id}`);
    await this.deleteService.removePage(id);
  }
}
