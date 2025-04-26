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
  BadRequestException,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { WeekMaterialsPageResponseDTO } from './dto/week-material-response.dto';
import { WeekMaterialsPageCreateService } from './services/WeekMaterialsPageCreateService';
import { WeekMaterialsPageUpdateService } from './services/WeekMaterialsPageUpdateService';
import { WeekMaterialsPageGetService } from './services/WeekMaterialsPageGetService';
import { WeekMaterialsPageRemoveService } from './services/WeekMaterialsPageRemoveService';
import { UpdateWeekMaterialsPageDto } from './dto/update-week-material.dto';
import { CreateWeekMaterialsPageDto } from './dto/create-week-material.dto';
import { WeekMaterialsPageEntity } from './entities/week-material-page.entity';

@Controller('week-material-pages')
export class WeekMaterialsPageController {
  private readonly logger = new Logger(WeekMaterialsPageController.name);

  constructor(
    private readonly createService: WeekMaterialsPageCreateService,
    private readonly updateService: WeekMaterialsPageUpdateService,
    private readonly removeService: WeekMaterialsPageRemoveService,
    private readonly getService: WeekMaterialsPageGetService,
  ) {}

  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('weekMaterialsPageData') raw: string,
  ): Promise<WeekMaterialsPageResponseDTO> {
    if (!raw) throw new BadRequestException('weekMaterialsPageData é obrigatório.');

    try {
      const parsed = JSON.parse(raw);
      const dto: CreateWeekMaterialsPageDto = await new ValidationPipe({ transform: true }).transform(parsed, {
        type: 'body',
        metatype: CreateWeekMaterialsPageDto,
      });

      const filesDict = Object.fromEntries(files.map((f) => [f.fieldname, f]));

      return await this.createService.createWeekMaterialsPage(dto, filesDict);
    } catch (err) {
      this.logger.error('❌ Erro ao criar página de materiais', err);
      throw new BadRequestException('Erro ao criar a página de materiais: ' + err.message);
    }
  }

  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  async update(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('weekMaterialsPageData') raw: string,
  ): Promise<WeekMaterialsPageResponseDTO> {
    if (!raw) throw new BadRequestException('weekMaterialsPageData é obrigatório.');

    try {
      const parsed = JSON.parse(raw);
      const dto = plainToInstance(UpdateWeekMaterialsPageDto, parsed);
      const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });

      if (errors.length > 0) throw new BadRequestException('Dados inválidos na requisição');

      const filesDict = Object.fromEntries(files.map((f) => [f.fieldname, f]));

      const result = await this.updateService.updateWeekMaterialsPage(id, dto, filesDict);
      this.logger.log(`✅ Página de materiais atualizada: ID=${result.id}`);
      return WeekMaterialsPageResponseDTO.fromEntity(result);
    } catch (err) {
      this.logger.error(`❌ Erro ao atualizar página de materiais ID=${id}`, err);
      throw new BadRequestException('Erro ao atualizar a página de materiais: ' + err.message);
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    try {
      await this.removeService.removeWeekMaterial(id);
      this.logger.log(`✅ Página removida: ID=${id}`);
    } catch (err) {
      this.logger.error(`❌ Erro ao remover página ID=${id}`, err);
      throw new BadRequestException('Erro ao remover a página de materiais: ' + err.message);
    }
  }

  @Get()
  async findAll(): Promise<WeekMaterialsPageResponseDTO[]> {
    return this.getService.findAllPagesWithMedia();
  }

  @Get('/current-week')
  async getCurrentWeek() {
    return this.getService.getCurrentWeek();
  }
  

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<WeekMaterialsPageResponseDTO> {
    return this.getService.findPageWithMedia(id);
  }

  @Post('/current-week/:id')
  async setCurrentWeek(@Param('id') id: string): Promise<any> {
    return this.getService.setCurrentWeek(id);
  }
}
