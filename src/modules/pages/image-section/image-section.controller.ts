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

import { CreateImageSectionDto } from './dto/create-image-section.dto';
import { UpdateImageSectionDto } from './dto/update-image-section.dto';
import { QueryImageSectionsDto } from './dto/query-image-sections.dto';
import { ImageSectionResponseDto } from './dto/image-section-response.dto';
import { ImageSectionCreateService } from './services/create-image-section.service';
import { GetImageSectionsService } from './services/get-image-sections.service';
import { ImageSectionUpdateService } from './services/update-image-section.service';
import { ImageSectionDeleteService } from './services/delete-image-section.service';
import { IMAGE_SECTION_PAYLOAD_FIELD } from './constants';
import { parseSectionPayload, toFilesDict } from './utils';

/**
 * Fotos enviadas pelos clubinhos.
 *
 * Qualquer pessoa autenticada envia; elas entram numa fila e a administração
 * decide o que vai para o feed.
 */
@Controller('image-sections')
export class ImageSectionController {
  private readonly logger = new Logger(ImageSectionController.name);

  constructor(
    private readonly createService: ImageSectionCreateService,
    private readonly getService: GetImageSectionsService,
    private readonly updateService: ImageSectionUpdateService,
    private readonly deleteService: ImageSectionDeleteService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(AnyFilesInterceptor())
  async create(
    @Request() req: AuthRequest,
    @UploadedFiles() files: Express.Multer.File[],
    @Body(IMAGE_SECTION_PAYLOAD_FIELD) raw: string | Buffer,
  ): Promise<ImageSectionResponseDto> {
    this.logger.debug('POST /image-sections');

    const dto = await parseSectionPayload(CreateImageSectionDto, raw);

    return this.createService.createSection(dto, toFilesDict(files), {
      email: req.user?.email,
    });
  }

  /** Fila de revisão. Sem filtro, traz pendentes e aprovadas. */
  @Get()
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async findAllPaginated(
    @Query() query: QueryImageSectionsDto,
  ): Promise<Paginated<ImageSectionResponseDto>> {
    this.logger.debug('GET /image-sections');
    return this.getService.findAllPaginated(query);
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
  ): Promise<ImageSectionResponseDto> {
    return this.getService.findOne(id);
  }

  /**
   * Revisa e aprova: publica no feed do clubinho.
   *
   * A rota não tinha guarda nenhuma — qualquer pessoa, autenticada ou não,
   * editava as fotos de qualquer clubinho.
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @UseInterceptors(AnyFilesInterceptor())
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body(IMAGE_SECTION_PAYLOAD_FIELD) raw: string | Buffer,
  ): Promise<ImageSectionResponseDto> {
    this.logger.debug(`PATCH /image-sections/${id}`);

    const dto = await parseSectionPayload(UpdateImageSectionDto, raw);

    return this.updateService.updateSection(id, dto, toFilesDict(files));
  }

  /** Recusa: sai da fila e os arquivos saem do bucket. */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    this.logger.debug(`DELETE /image-sections/${id}`);

    await this.deleteService.deleteSection(id);

    return { message: 'Publicação de fotos removida com sucesso' };
  }
}
