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
import { RoleGuard } from 'src/auth/guards/role-guard';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ImageSectionUpdateService } from './services/image-section-update-service';
import { ImageSectionGetService } from './services/image-section-get-service';
import { ImageSectionDeleteService } from './services/image-section-delete-service';
import { ImageSectionResponseDto } from './dto/image-section-response.dto';
import { CreateImageSectionDto } from './dto/create-image-section.dto';
import { UpdateImageSectionDto } from './dto/update-image-section.dto';
import { ImageSectionCreateService } from './services/Image-section-create-service';

@Controller('image-sections')
export class ImageSectionController {
  private readonly logger = new Logger(ImageSectionController.name);

  constructor(
    private readonly createService: ImageSectionCreateService,
    private readonly updateService: ImageSectionUpdateService,
    private readonly getService: ImageSectionGetService,
    private readonly deleteService: ImageSectionDeleteService,
  ) {}

  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('sectionData') raw: string,
  ): Promise<ImageSectionResponseDto> {
    this.logger.debug('🚀 Criando nova section');

    const dto = this.parseDto<CreateImageSectionDto>(raw, CreateImageSectionDto);
    await this.validateDto(dto);

    const filesDict = this.mapFiles(files);
    const result = await this.createService.createSection(dto, filesDict);

    this.logger.log(`✅ Section criada com ID=${result.id}`);
    return result;
  }

  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  async update(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('sectionData') raw: string,
  ): Promise<ImageSectionResponseDto> {
    this.logger.debug(`🚀 Atualizando section ID=${id}`);

    const dto = this.parseDto<UpdateImageSectionDto>(raw, UpdateImageSectionDto);
    await this.validateDto(dto);

    const filesDict = this.mapFiles(files);
    const result = await this.updateService.updateSection(id, dto, filesDict);

    this.logger.log(`✅ Section atualizada com ID=${result.id}`);
    return result;
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    this.logger.debug(`🚀 Removendo section ID=${id}`);

    await this.deleteService.deleteSection(id);
    this.logger.log(`✅ Section removida com ID=${id}`);

    return { message: 'Section removida com sucesso.' };
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<ImageSectionResponseDto> {
    this.logger.debug(`🚀 Buscando section ID=${id}`);

    const result = await this.getService.findOne(id);
    if (!result) {
      throw new NotFoundException(`Section com id=${id} não encontrada`);
    }

    this.logger.log(`✅ Section encontrada ID=${id}`);
    return result;
  }

  @Get()
  async getAll(): Promise<ImageSectionResponseDto[]> {
    this.logger.debug('🚀 Listando todas as sections');

    const result = await this.getService.findAll();
    this.logger.log(`✅ ${result.length} sections encontradas`);
    return result;
  }

  private parseDto<T>(raw: string, dtoClass: new () => T): T {
    try {
      const obj = JSON.parse(raw);
      return plainToInstance(dtoClass, obj);
    } catch (error) {
      this.logger.error('❌ Erro ao fazer o parse do JSON recebido.', error);
      throw new BadRequestException('Formato inválido de JSON.');
    }
  }

  private async validateDto(dto: object): Promise<void> {
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length > 0) {
      this.logger.error('❌ Erros de validação:', JSON.stringify(errors, null, 2));
      throw new BadRequestException('Dados inválidos na requisição.');
    }
  }

  private mapFiles(files: Express.Multer.File[]): Record<string, Express.Multer.File> {
    return files.reduce((acc, file) => {
      acc[file.fieldname] = file;
      return acc;
    }, {} as Record<string, Express.Multer.File>);
  }
}
