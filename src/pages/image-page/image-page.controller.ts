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
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ImagePageResponseDto } from './dto/image-page-response.dto';
import { CreateImagePageDto } from './dto/create-image.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateImagePageDto } from './dto/update-image.dto';
import { ImagePageCreateService } from './services/ImagePageCreateService';
import { ImagePageDeleteService } from './services/ImagePageDeleteService';
import { ImagePageGetService } from './services/ImagePageGetService';
import { ImagePageUpdateService } from './services/ImagePageUpdateService';

@Controller('image-pages')
export class ImageController {
  private readonly logger = new Logger(ImageController.name);

  constructor(
    private readonly imagePageCreateService: ImagePageCreateService,
    private readonly imagePageDeleteService: ImagePageDeleteService,
    private readonly imagePageGetService: ImagePageGetService,
    private readonly imagePageUpdateService: ImagePageUpdateService,
  ) { }

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  async createImagePage(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('imageData') raw: string,
  ): Promise<ImagePageResponseDto> {
    this.logger.debug('🚀 Recebendo requisição para criar uma nova galeria');

    try {
      const parsedData = JSON.parse(raw);
      const dto = plainToInstance(CreateImagePageDto, parsedData);

      const validationErrors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      if (validationErrors.length > 0) {
        this.logger.error('❌ Erros de validação no DTO:', JSON.stringify(validationErrors, null, 2));
        throw new BadRequestException('Dados inválidos na requisição');
      }

      const filesDict: Record<string, Express.Multer.File> = {};
      files.forEach((file) => (filesDict[file.fieldname] = file));

      const result = await this.imagePageCreateService.createImagePage(dto, filesDict);
      this.logger.log(`✅ Galeria criada com sucesso: ID=${result.id}`);

      return result;
    } catch (error) {
      this.logger.error('Erro ao criar galeria', error);
      throw new BadRequestException('Erro ao criar a galeria.');
    }
  }

  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  async updateImagePage(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('imageData') raw: string,
  ): Promise<ImagePageResponseDto> {
    this.logger.debug('🚀 Recebendo requisição para atualizar galeria com ID:', id);

    try {
      const rawObject = JSON.parse(raw);
      rawObject.sections?.forEach((section) => {
        section.mediaItems?.forEach((media) => {
          delete media.file;
        });
      });

      const parsedDto = plainToInstance(UpdateImagePageDto, rawObject);
      const errors = await validate(parsedDto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      if (errors.length > 0) {
        this.logger.warn('❌ Validação falhou ao atualizar galeria:', errors);
        throw new BadRequestException('Dados inválidos na requisição');
      }

      const filesDict: Record<string, Express.Multer.File> = {};
      files.forEach((file) => (filesDict[file.fieldname] = file));

      return await this.imagePageUpdateService.updateImagePage(id, parsedDto, filesDict);
    } catch (err) {
      this.logger.error('❌ Erro ao atualizar galeria', err);
      throw new BadRequestException('Erro ao atualizar a galeria.');
    }

  }

  @Get()
  async findAll(): Promise<ImagePageResponseDto[]> {
    return this.imagePageGetService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ImagePageResponseDto> {
    try {
      return await this.imagePageGetService.findOne(id);
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      throw new BadRequestException('Erro ao buscar galeria.');
    }
  }

  @Delete(':id')
  async removePage(@Param('id') id: string) {
    await this.imagePageDeleteService.removePage(id);
    return { message: 'Página de galeria removida com sucesso' };
  }
}
