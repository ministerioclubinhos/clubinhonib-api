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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';

import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';

import { CreateIdeasPageDto } from './dto/create-ideas-page.dto';
import { UpdateIdeasPageDto } from './dto/update-ideas-page.dto';
import { IdeasPageResponseDto } from './dto/ideas-page-response.dto';
import { IdeasPageSummaryDto } from './dto/ideas-page-summary.dto';
import { QueryIdeasPagesDto } from './dto/query-ideas-pages.dto';
import { Paginated } from 'src/shared/dto/paginated.dto';
import { IdeasPageCreateService } from './services/create-ideas-page.service';
import { IdeasPageGetService } from './services/get-ideas-page.service';
import { IdeasPageUpdateService } from './services/update-ideas-page.service';
import { IdeasPageDeleteService } from './services/delete-ideas-page.service';
import { buildFilesDict, parseAndValidatePayload } from './utils';
import { IDEAS_PAGE_PAYLOAD_FIELD } from './constants';

@Controller('ideas-pages')
export class IdeasPageController {
  private readonly logger = new Logger(IdeasPageController.name);

  constructor(
    private readonly createService: IdeasPageCreateService,
    private readonly getService: IdeasPageGetService,
    private readonly updateService: IdeasPageUpdateService,
    private readonly deleteService: IdeasPageDeleteService,
  ) {}

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body(IDEAS_PAGE_PAYLOAD_FIELD) raw: string,
  ): Promise<IdeasPageResponseDto> {
    this.logger.debug('POST /ideas-pages');

    const dto = await parseAndValidatePayload(raw, CreateIdeasPageDto);

    return this.createService.createIdeasPage(dto, buildFilesDict(files));
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body(IDEAS_PAGE_PAYLOAD_FIELD) raw: string,
  ): Promise<IdeasPageResponseDto> {
    this.logger.debug(`PATCH /ideas-pages/${id}`);

    const dto = await parseAndValidatePayload(raw, UpdateIdeasPageDto);

    return this.updateService.updateIdeasPage(id, dto, buildFilesDict(files));
  }

  /**
   * Listagem do painel. Exige sessão: é o inventário administrativo das
   * páginas de ideias, inclusive das que não estão publicadas.
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @Query() query: QueryIdeasPagesDto,
  ): Promise<Paginated<IdeasPageSummaryDto>> {
    this.logger.debug('GET /ideas-pages');
    return this.getService.findAllPaginated(query);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<IdeasPageResponseDto> {
    this.logger.debug(`GET /ideas-pages/${id}`);
    return this.getService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    this.logger.debug(`DELETE /ideas-pages/${id}`);
    await this.deleteService.removePage(id);
  }
}
