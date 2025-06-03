import {
  Controller,
  Post,
  Delete,
  Param,
  Body,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  Logger,
  ValidationPipe,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateIdeasPageDto } from './dto/create-ideas-page.dto';
import { IdeasPageResponseDto } from './dto/ideas-page-response.dto';
import { UpdateIdeasPageDto } from './dto/update-ideas-page.dto';

import { IdeasPageCreateService } from './services/ideas-page-create.service';
import { IdeasPageRemoveService } from './services/ideas-page-remove.service';
import { IdeasPageGetService } from './services/ideas-page-get.service';
import { IdeasPageUpdateService } from './services/ideas-page-update.service';

import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RoleGuard } from 'src/auth/guards/role-guard';

@Controller('ideas-pages')
export class IdeasPageController {
  private readonly logger = new Logger(IdeasPageController.name);

  constructor(
    private readonly ideasPageCreateService: IdeasPageCreateService,
    private readonly ideasPageRemoveService: IdeasPageRemoveService,
    private readonly ideasPageGetService: IdeasPageGetService,
    private readonly updateIdeasPageService: IdeasPageUpdateService,
  ) {}

  @UseGuards(JwtAuthGuard, RoleGuard)
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  async create(
    @UploadedFiles() files: Express.Multer.File[] = [],
    @Body('ideasMaterialsPageData') raw: string,
  ): Promise<IdeasPageResponseDto> {
    this.logger.debug('🚀 [POST /ideas-pages] Criando página de ideias');

    try {
      if (!raw) {
        throw new BadRequestException('ideasMaterialsPageData é obrigatório.');
      }

      const parsed = JSON.parse(raw);
      const validationPipe = new ValidationPipe({ transform: true });
      const dto: CreateIdeasPageDto = await validationPipe.transform(parsed, {
        type: 'body',
        metatype: CreateIdeasPageDto,
      });

      const filesDict: Record<string, Express.Multer.File> = {};
      files.forEach((f) => {
        this.logger.debug(`📎 Arquivo recebido - fieldname: ${f.fieldname}`);
        filesDict[f.fieldname] = f;
      });

      const result = await this.ideasPageCreateService.createIdeasPage(dto, filesDict);
      this.logger.log(`✅ Página criada com sucesso: ID=${result.id}`);
      return result;
    } catch (err) {
      this.logger.error('❌ Erro ao criar página de ideias', err);
      throw new BadRequestException(
        'Erro ao criar página de ideias: ' + err.message,
      );
    }
  }

  @UseGuards(JwtAuthGuard, RoleGuard)
  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  async update(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('ideasMaterialsPageData') raw: string,
  ): Promise<IdeasPageResponseDto> {
    this.logger.debug(`🚀 [PATCH /ideas-pages/${id}] Atualizando página de ideias`);

    try {
      if (!raw) throw new BadRequestException('ideasMaterialsPageData é obrigatório.');

      const parsedData = JSON.parse(raw);
      const dto = plainToInstance(UpdateIdeasPageDto, parsedData);
      const validationErrors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      if (validationErrors.length > 0) {
        this.logger.error('❌ Erros de validação:', JSON.stringify(validationErrors, null, 2));
        throw new BadRequestException('Dados inválidos na requisição');
      }

      const filesDict: Record<string, Express.Multer.File> = {};
      files.forEach((file) => (filesDict[file.fieldname] = file));

      const result = await this.updateIdeasPageService.updateIdeasPage(id, dto, filesDict);
      this.logger.log(`✅ Página de ideias atualizada com sucesso: ID=${result.id}`);
      return IdeasPageResponseDto.fromEntity(result, new Map());
    } catch (error) {
      this.logger.error('❌ Erro ao atualizar página de ideias', error);
      throw new BadRequestException('Erro ao atualizar a página de ideias.');
    }
  }

  @UseGuards(JwtAuthGuard, RoleGuard)
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    this.logger.debug(`🚀 [DELETE /ideas-pages/${id}] Removendo página de ideias`);

    try {
      await this.ideasPageRemoveService.removeIdeasPage(id);
      this.logger.log(`✅ Página de ideias removida com sucesso: ID=${id}`);
    } catch (error) {
      this.logger.error('❌ Erro ao remover página de ideias', error);
      throw new BadRequestException(
        'Erro ao remover a página de ideias: ' + error.message,
      );
    }
  }

  @Get()
  async findAll(): Promise<IdeasPageResponseDto[]> {
    this.logger.debug('📥 [GET /ideas-pages] Listando todas as páginas de ideias');
    return this.ideasPageGetService.findAllPagesWithMedia();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<IdeasPageResponseDto> {
    this.logger.debug(`📄 [GET /ideas-pages/${id}] Buscando página de ideias`);
    return this.ideasPageGetService.findPageWithMedia(id);
  }
}
