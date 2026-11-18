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
  Query,
  Request,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';

import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';
import { AuthRequest } from 'src/core/auth/auth.types';
import { Paginated } from 'src/shared/dto/paginated.dto';

import { CreateIdeasSectionDto } from './dto/create-ideas-section.dto';
import { UpdateIdeasSectionDto } from './dto/update-ideas-section.dto';
import { QueryIdeasSectionsDto } from './dto/query-ideas-sections.dto';
import { IdeasSectionResponseDto } from './dto/ideas-section-response.dto';
import { CreateIdeasSectionService } from './services/create-ideas-section.service';
import { GetIdeasSectionsService } from './services/get-ideas-sections.service';
import { UpdateIdeasSectionService } from './services/update-ideas-section.service';
import { AttachIdeasSectionService } from './services/attach-ideas-section.service';
import { DeleteIdeasSectionService } from './services/delete-ideas-section.service';
import {
  IDEAS_SECTION_PAYLOAD_FIELD,
  IDEAS_SHARE_UPLOAD_LIMITS,
} from './constants';
import { parseSectionPayload, toFilesDict } from './utils';

/**
 * Ideias compartilhadas pela base.
 *
 * Qualquer pessoa autenticada envia uma ideia; ela entra na fila e só a
 * administração decide se e em qual página publicar.
 */
@Controller('ideas-sections')
export class IdeasSectionController {
  private readonly logger = new Logger(IdeasSectionController.name);

  constructor(
    private readonly createService: CreateIdeasSectionService,
    private readonly getService: GetIdeasSectionsService,
    private readonly updateService: UpdateIdeasSectionService,
    private readonly attachService: AttachIdeasSectionService,
    private readonly deleteService: DeleteIdeasSectionService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(AnyFilesInterceptor({ limits: IDEAS_SHARE_UPLOAD_LIMITS }))
  async create(
    @Request() req: AuthRequest,
    @UploadedFiles() files: Express.Multer.File[],
    @Body(IDEAS_SECTION_PAYLOAD_FIELD) raw: string | Buffer,
  ): Promise<IdeasSectionResponseDto> {
    this.logger.debug('POST /ideas-sections');

    const dto = await parseSectionPayload(CreateIdeasSectionDto, raw);

    return this.createService.createSection(dto, toFilesDict(files), {
      email: req.user?.email,
    });
  }

  /** Fila da administração: ideias que ainda aguardam decisão. */
  @Get()
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async findPending(
    @Query() query: QueryIdeasSectionsDto,
  ): Promise<Paginated<IdeasSectionResponseDto>> {
    this.logger.debug('GET /ideas-sections');
    return this.getService.findPendingPaginated(query);
  }

  @Get('pending-count')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async countPending(): Promise<{ pending: number }> {
    return this.getService.countPending();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<IdeasSectionResponseDto> {
    return this.getService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @UseInterceptors(AnyFilesInterceptor({ limits: IDEAS_SHARE_UPLOAD_LIMITS }))
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body(IDEAS_SECTION_PAYLOAD_FIELD) raw: string | Buffer,
  ): Promise<IdeasSectionResponseDto> {
    this.logger.debug(`PATCH /ideas-sections/${id}`);

    const dto = await parseSectionPayload(UpdateIdeasSectionDto, raw);

    return this.updateService.updateSection(id, dto, toFilesDict(files));
  }

  /** Aceita a ideia e a publica na página escolhida. */
  @Patch(':id/attach/:pageId')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @UseInterceptors(AnyFilesInterceptor({ limits: IDEAS_SHARE_UPLOAD_LIMITS }))
  async attachToPage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body(IDEAS_SECTION_PAYLOAD_FIELD) raw: string | Buffer,
  ): Promise<IdeasSectionResponseDto> {
    this.logger.debug(`PATCH /ideas-sections/${id}/attach/${pageId}`);

    const dto = await parseSectionPayload(UpdateIdeasSectionDto, raw);

    return this.attachService.attachToPage(id, pageId, dto, toFilesDict(files));
  }

  /** Recusa a ideia: sai da fila e os arquivos saem do bucket. */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    this.logger.debug(`DELETE /ideas-sections/${id}`);

    await this.deleteService.deleteSection(id);

    return { message: 'Ideia compartilhada removida com sucesso' };
  }
}
