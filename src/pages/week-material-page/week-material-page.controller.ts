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
  UseGuards,
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

import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RoleGuard } from 'src/auth/guards/role-guard';

@Controller('week-material-pages')
export class WeekMaterialsPageController {
  private readonly logger = new Logger(WeekMaterialsPageController.name);

  constructor(
    private readonly createService: WeekMaterialsPageCreateService,
    private readonly updateService: WeekMaterialsPageUpdateService,
    private readonly removeService: WeekMaterialsPageRemoveService,
    private readonly getService: WeekMaterialsPageGetService,
  ) {}

  @UseGuards(JwtAuthGuard, RoleGuard)
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('weekMaterialsPageData') raw: string,
  ): Promise<WeekMaterialsPageResponseDTO> {
    this.logger.debug('📥 [POST /week-material-pages] Criando nova página de materiais');

    if (!raw) throw new BadRequestException('weekMaterialsPageData é obrigatório.');

    try {
      const parsed = JSON.parse(raw);
      const dto: CreateWeekMaterialsPageDto = await new ValidationPipe({ transform: true }).transform(parsed, {
        type: 'body',
        metatype: CreateWeekMaterialsPageDto,
      });

      const filesDict = Object.fromEntries(files.map((f) => [f.fieldname, f]));

      const result = await this.createService.createWeekMaterialsPage(dto, filesDict);
      this.logger.log(`✅ Página criada com sucesso: ID=${result.id}`);
      return result;
    } catch (err) {
      this.logger.error('❌ Erro ao criar página de materiais', err);
      throw new BadRequestException('Erro ao criar a página de materiais: ' + err.message);
    }
  }

  @UseGuards(JwtAuthGuard, RoleGuard)
  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  async update(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('weekMaterialsPageData') raw: string,
  ): Promise<WeekMaterialsPageResponseDTO> {
    this.logger.debug(`✏️ [PATCH /week-material-pages/${id}] Atualizando página de materiais`);

    if (!raw) throw new BadRequestException('weekMaterialsPageData é obrigatório.');

    try {
      const parsed = JSON.parse(raw);
      const dto = plainToInstance(UpdateWeekMaterialsPageDto, parsed);
      const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });

      if (errors.length > 0) throw new BadRequestException('Dados inválidos na requisição');

      const filesDict = Object.fromEntries(files.map((f) => [f.fieldname, f]));

      const result = await this.updateService.updateWeekMaterialsPage(id, dto, filesDict);
      this.logger.log(`✅ Página atualizada com sucesso: ID=${result.id}`);
      return WeekMaterialsPageResponseDTO.fromEntity(result);
    } catch (err) {
      this.logger.error(`❌ Erro ao atualizar página ID=${id}`, err);
      throw new BadRequestException('Erro ao atualizar a página de materiais: ' + err.message);
    }
  }

  @UseGuards(JwtAuthGuard, RoleGuard)
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    this.logger.debug(`🗑️ [DELETE /week-material-pages/${id}] Removendo página de materiais`);
    try {
      await this.removeService.removeWeekMaterial(id);
      this.logger.log(`✅ Página removida com sucesso: ID=${id}`);
    } catch (err) {
      this.logger.error(`❌ Erro ao remover página ID=${id}`, err);
      throw new BadRequestException('Erro ao remover a página de materiais: ' + err.message);
    }
  }

  @Get()
  async findAll(): Promise<WeekMaterialsPageResponseDTO[]> {
    this.logger.debug('📄 [GET /week-material-pages] Listando todas as páginas de materiais');
    return this.getService.findAllPagesWithMedia();
  }

  @Get('/current-week')
  async getCurrentWeek() {
    this.logger.debug('📆 [GET /week-material-pages/current-week] Buscando página atual');
    return this.getService.getCurrentWeek();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<WeekMaterialsPageResponseDTO> {
    this.logger.debug(`🔍 [GET /week-material-pages/${id}] Buscando página de materiais`);
    return this.getService.findPageWithMedia(id);
  }

  @UseGuards(JwtAuthGuard, RoleGuard)
  @Post('/current-week/:id')
  async setCurrentWeek(@Param('id') id: string): Promise<any> {
    this.logger.debug(`📌 [POST /week-material-pages/current-week/${id}] Definindo página atual`);
    return this.getService.setCurrentWeek(id);
  }
}
