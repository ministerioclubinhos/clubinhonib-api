import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  UploadedFiles,
  Body,
  UseInterceptors,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { AppValidationException, AppNotFoundException, AppInternalException, ErrorCode } from 'src/shared/exceptions';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateVideosPageDto } from './dto/create-videos-page.dto';
import { UpdateVideosPageDto } from './dto/update-videos-page.dto';
import { VideosPageResponseDto } from './dto/videos-page-response.dto';
import { CreateVideosPageService } from './services/videos-page.create.service';
import { UpdateVideosPageService } from './services/videos-page.update.service';
import { GetVideosPageService } from './services/videos-page.get.service';
import { DeleteVideosPageService } from './services/videos-page.delete.service';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';

@Controller('video-pages')
export class VideosPageController {
  private readonly logger = new Logger(VideosPageController.name);

  constructor(
    private readonly createService: CreateVideosPageService,
    private readonly updateService: UpdateVideosPageService,
    private readonly getService: GetVideosPageService,
    private readonly deleteService: DeleteVideosPageService,
  ) { }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('videosPageData') raw: string,
  ): Promise<VideosPageResponseDto> {
    this.logger.debug('📥 [POST /video-pages] Criando nova página de vídeos');

    try {
      const parsedData = JSON.parse(raw);
      const dto = plainToInstance(CreateVideosPageDto, parsedData);

      const validationErrors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      if (validationErrors.length > 0) {
        this.logger.error('❌ Erros de validação:', JSON.stringify(validationErrors, null, 2));
        throw new AppValidationException(ErrorCode.VALIDATION_ERROR, 'Dados inválidos na requisição');
      }

      const filesDict: Record<string, Express.Multer.File> = {};
      files.forEach((file) => (filesDict[file.fieldname] = file));

      const result = await this.createService.execute(dto, filesDict);
      this.logger.log(`✅ Página de vídeos criada com sucesso: ID=${result.id}`);
      return result;
    } catch (error) {
      this.logger.error('❌ Erro ao criar página de vídeos', error);
      throw new AppInternalException(ErrorCode.INTERNAL_ERROR, 'Erro ao criar a página de vídeos.');
    }
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  async update(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('videosPageData') raw: string,
  ): Promise<VideosPageResponseDto> {
    this.logger.debug(`✏️ [PATCH /video-pages/${id}] Atualizando página de vídeos`);

    try {
      const parsedData = JSON.parse(raw);
      const dto = plainToInstance(UpdateVideosPageDto, parsedData);

      const validationErrors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      if (validationErrors.length > 0) {
        this.logger.error('❌ Erros de validação:', JSON.stringify(validationErrors, null, 2));
        throw new AppValidationException(ErrorCode.VALIDATION_ERROR, 'Dados inválidos na requisição');
      }

      const filesDict: Record<string, Express.Multer.File> = {};
      files.forEach((file) => (filesDict[file.fieldname] = file));

      const result = await this.updateService.execute(id, dto, filesDict);
      this.logger.log(`✅ Página de vídeos atualizada com sucesso: ID=${result.id}`);
      return result;
    } catch (error) {
      this.logger.error('❌ Erro ao atualizar página de vídeos', error);
      throw new AppInternalException(ErrorCode.INTERNAL_ERROR, 'Erro ao atualizar a página de vídeos.');
    }
  }

  @Get()
  async findAll(): Promise<VideosPageResponseDto[]> {
    this.logger.debug('📄 [GET /video-pages] Listando todas as páginas de vídeos');
    return this.getService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<VideosPageResponseDto> {
    this.logger.debug(`🔍 [GET /video-pages/${id}] Buscando página de vídeos`);
    try {
      return await this.getService.findOne(id);
    } catch (err) {
      if (err instanceof AppNotFoundException) throw err;
      this.logger.error('❌ Erro ao buscar página de vídeos', err);
      throw new AppInternalException(ErrorCode.INTERNAL_ERROR, 'Erro ao buscar página de vídeos.');
    }
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    this.logger.debug(`🗑️ [DELETE /video-pages/${id}] Removendo página de vídeos`);
    await this.deleteService.execute(id);
    this.logger.log(`✅ Página de vídeos removida com sucesso: ID=${id}`);
    return { message: 'Página de vídeos removida com sucesso' };
  }
}
