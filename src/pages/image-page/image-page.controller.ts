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
  BadRequestException,
  Logger,
  UseGuards,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ImagePageResponseDto } from './dto/image-page-response.dto';
import { CreateImagePageDto } from './dto/create-image.dto';
import { UpdateImagePageDto } from './dto/update-image.dto';
import { ImagePageCreateService } from './services/ImagePageCreateService';
import { ImagePageDeleteService } from './services/ImagePageDeleteService';
import { ImagePageGetService } from './services/ImagePageGetService';
import { ImagePageUpdateService } from './services/ImagePageUpdateService';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RoleGuard } from 'src/auth/guards/role-guard';
import { PaginatedImageSectionResponseDto } from './dto/paginated-image-section.dto';

@Controller('image-pages')
export class ImageController {
  private readonly logger = new Logger(ImageController.name);

  constructor(
    private readonly createService: ImagePageCreateService,
    private readonly deleteService: ImagePageDeleteService,
    private readonly getService: ImagePageGetService,
    private readonly updateService: ImagePageUpdateService,
  ) { }

  @UseGuards(JwtAuthGuard, RoleGuard)
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('imageData') raw: string,
  ): Promise<ImagePageResponseDto> {
    this.logger.debug('🚀 Criando nova galeria');

    try {
      const dto = plainToInstance(CreateImagePageDto, JSON.parse(raw));
      await this.validateDto(dto);

      const filesDict = this.mapFiles(files);

      const result = await this.createService.createImagePage(dto, filesDict);
      this.logger.log(`✅ Galeria criada: ID=${result.id}`);

      return result;
    } catch (error) {
      this.logger.error('❌ Erro ao criar galeria', error);
      throw new BadRequestException('Erro ao criar a galeria.');
    }
  }

  @UseGuards(JwtAuthGuard, RoleGuard)
  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  async update(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('imageData') raw: string,
  ): Promise<ImagePageResponseDto> {
    this.logger.debug(`🚀 Atualizando galeria ID=${id}`);

    try {
      const rawObject = JSON.parse(raw);
      this.cleanMediaFiles(rawObject);

      const dto = plainToInstance(UpdateImagePageDto, rawObject);
      await this.validateDto(dto);

      const filesDict = this.mapFiles(files);

      return await this.updateService.updateImagePage(id, dto, filesDict);
    } catch (error) {
      this.logger.error('❌ Erro ao atualizar galeria', error);
      throw new BadRequestException('Erro ao atualizar a galeria.');
    }
  }

  @Get()
  async findAll(): Promise<ImagePageResponseDto[]> {
    return this.getService.findAll();
  }

  @Get(':id/sections')
  async getPaginatedSections(
    @Param('id') pageId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '2',
  ): Promise<PaginatedImageSectionResponseDto> {
    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    this.logger.debug(`📥 Requisição recebida para seções paginadas — pageId=${pageId}, page=${pageNumber}, limit=${limitNumber}`);

    return this.getService.findSectionsPaginated(pageId, pageNumber, limitNumber);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ImagePageResponseDto> {
    try {
      return await this.getService.findOne(id);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException('Erro ao buscar galeria.');
    }
  }

  @UseGuards(JwtAuthGuard, RoleGuard)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.deleteService.removePage(id);
    return { message: 'Página de galeria removida com sucesso' };
  }

  // Helpers
  private async validateDto(dto: object) {
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length > 0) {
      this.logger.error('❌ Erros de validação:', JSON.stringify(errors, null, 2));
      throw new BadRequestException('Dados inválidos na requisição');
    }
  }

  private mapFiles(files: Express.Multer.File[]): Record<string, Express.Multer.File> {
    return files.reduce((acc, file) => {
      acc[file.fieldname] = file;
      return acc;
    }, {} as Record<string, Express.Multer.File>);
  }

  private cleanMediaFiles(rawObject: any) {
    rawObject.sections?.forEach(section =>
      section.mediaItems?.forEach(media => {
        delete media.file;
      })
    );
  }
}
