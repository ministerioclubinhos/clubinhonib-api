import {
  Controller,
  Post,
  Patch,
  Delete,
  Get,
  Param,
  Body,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/auth/guards/role-guard';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IdeasSectionUpdateService } from './services/ideas-section-update.service';
import { IdeasSectionGetService } from './services/ideas-section-get.service';
import { IdeasSectionDeleteService } from './services/ideas-section-delete.service';
import { IdeasSectionResponseDto } from './dto/ideas-section-response.dto';
import { CreateIdeasSectionDto } from './dto/create-ideas-section.dto';
import { UpdateIdeasSectionDto } from './dto/update-ideas-section.dto';
import { IdeasSectionCreateService } from './services/ideas-section-create.service';

@Controller('ideas-sections')
export class IdeasSectionController {
  private readonly logger = new Logger(IdeasSectionController.name);

  constructor(
    private readonly createService: IdeasSectionCreateService,
    private readonly updateService: IdeasSectionUpdateService,
    private readonly getService: IdeasSectionGetService,
    private readonly deleteService: IdeasSectionDeleteService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('sectionData') raw: string | Buffer,
  ): Promise<IdeasSectionResponseDto> {
    this.logger.debug('🚀 Criando nova seção de ideias órfã');
    this.logger.debug(`📁 Arquivos recebidos: ${files?.length || 0}`);
    this.logger.debug(`📋 Arquivos: ${JSON.stringify(files?.map(f => ({ fieldname: f.fieldname, originalname: f.originalname })) || [])}`);
    this.logger.debug(`📄 Raw data type: ${typeof raw}`);
    this.logger.debug(`📄 Raw data: ${Buffer.isBuffer(raw) ? raw.toString() : raw}`);

    const parsedData = JSON.parse(Buffer.isBuffer(raw) ? raw.toString() : raw);
    const dto = plainToInstance(CreateIdeasSectionDto, parsedData);
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
    this.logger.debug(`🗂️ FilesDict: ${JSON.stringify(Object.keys(filesDict))}`);
    const result = await this.createService.createSection(dto, filesDict);

    this.logger.log(`✅ Seção de ideias criada com ID=${result.id}`);
    return result;
  }

 @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  async update(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('sectionData') raw: string | Buffer,
  ): Promise<IdeasSectionResponseDto> {
    this.logger.debug(`🚀 Atualizando seção de ideias ID=${id}`);

    const parsedData = JSON.parse(Buffer.isBuffer(raw) ? raw.toString() : raw);
    const dto = plainToInstance(UpdateIdeasSectionDto, parsedData);
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
    const result = await this.updateService.updateSection(id, dto, filesDict);

    this.logger.log(`✅ Seção de ideias atualizada com ID=${result.id}`);
    return result;
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Patch(':id/attach/:pageId')
  @UseInterceptors(AnyFilesInterceptor())
  async editAndAttachToPage(
    @Param('id') sectionId: string,
    @Param('pageId') pageId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('sectionData') raw: string,
  ): Promise<IdeasSectionResponseDto> {
    this.logger.debug(`🚀 [PATCH /ideas-sections/${sectionId}/attach/${pageId}] Editando e vinculando seção`);

    try {
      if (!raw) throw new BadRequestException('sectionData é obrigatório.');

      const parsedData = JSON.parse(Buffer.isBuffer(raw) ? raw.toString() : raw);
      const dto = plainToInstance(UpdateIdeasSectionDto, parsedData);
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

      const result = await this.updateService.editAndAttachSectionToPage(sectionId, pageId, dto, filesDict);
      this.logger.log(`✅ Seção editada e vinculada com sucesso: ID=${result.id}`);
      return result;
    } catch (error) {
      this.logger.error('❌ Erro ao editar e vincular seção', error);
      throw new BadRequestException('Erro ao editar e vincular a seção de ideias.');
    }
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Delete(':id')
  async delete(@Param('id') id: string) {
    this.logger.debug(`🚀 Removendo seção de ideias ID=${id}`);

    await this.deleteService.deleteSection(id);
    this.logger.log(`✅ Seção de ideias removida com ID=${id}`);

    return { message: 'Seção de ideias removida com sucesso.' };
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<IdeasSectionResponseDto> {
    this.logger.debug(`🚀 Buscando seção de ideias ID=${id}`);

    const result = await this.getService.findOne(id);
    if (!result) {
      throw new NotFoundException(`Seção de ideias com id=${id} não encontrada`);
    }

    this.logger.log(`✅ Seção de ideias encontrada ID=${id}`);
    return result;
  }

  @Get()
  async getAll(): Promise<IdeasSectionResponseDto[]> {
    this.logger.debug('🚀 Listando todas as seções de ideias órfãs');

    const result = await this.getService.findAll();
    this.logger.log(`✅ ${result.length} seções de ideias encontradas`);
    return result;
  }

}
