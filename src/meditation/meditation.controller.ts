import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  HttpCode,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { plainToInstance } from 'class-transformer';
import { validateOrReject, validateSync } from 'class-validator';

import { CreateMeditationService } from './services/create-meditation.service';
import { UpdateMeditationService } from './services/update-meditation.service';
import { DeleteMeditationService } from './services/delete-meditation.service';
import { GetMeditationService } from './services/get-meditation.service';

import { CreateMeditationDto } from './dto/create-meditation.dto';
import { UpdateMeditationDto } from './dto/update-meditation.dto';
import { MeditationEntity } from './entities/meditation.entity';
import { WeekMeditationResponseDto } from './dto/meditation-response-dto';

import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/auth/guards/role-guard';

@Controller('meditations')
export class MeditationController {
  private readonly logger = new Logger(MeditationController.name);

  constructor(
    private readonly createService: CreateMeditationService,
    private readonly updateService: UpdateMeditationService,
    private readonly deleteService: DeleteMeditationService,
    private readonly getService: GetMeditationService,
  ) { }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body('meditationData') meditationDataRaw: string,
  ): Promise<MeditationEntity> {
    this.logger.log('📥 [POST /meditations] Criando nova meditação');

    try {
      const parsed = JSON.parse(meditationDataRaw);
      const dto = plainToInstance(CreateMeditationDto, parsed);
      await validateOrReject(dto, { whitelist: true, forbidNonWhitelisted: true });

      const result = await this.createService.create(dto, file);
      this.logger.log(`✅ Meditação criada: ID=${result.id}`);
      return result;
    } catch (error) {
      this.logger.error('❌ Erro ao criar meditação', error.stack);
      const message =
        Array.isArray(error)
          ? error.map(e => Object.values(e.constraints || {})).flat().join('; ')
          : error?.message || 'Erro ao criar meditação.';
      throw new BadRequestException(message);
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(): Promise<WeekMeditationResponseDto[]> {
    this.logger.log('📦 [GET /meditations] Listando todas as meditações');
    return this.getService.findAll();
  }

  @Get('/this-week')
  @UseGuards(JwtAuthGuard)
  async getThisWeek(): Promise<WeekMeditationResponseDto> {
    this.logger.log('📆 [GET /meditations/this-week] Buscando meditação da semana');
    return this.getService.getThisWeekMeditation();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string): Promise<WeekMeditationResponseDto> {
    this.logger.log(`🔍 [GET /meditations/${id}] Buscando meditação`);
    return this.getService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Patch(':id')
  @UseInterceptors(FileInterceptor('file'))
  async update(
    @Param('id') id: string,
    @Body('meditationData') rawMeditationData: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<MeditationEntity> {
    this.logger.log(`✏️ [PATCH /meditations/${id}] Atualizando meditação`);

    let dto: UpdateMeditationDto;
    try {
      const parsed = JSON.parse(rawMeditationData);
      dto = plainToInstance(UpdateMeditationDto, parsed);
    } catch (err) {
      this.logger.error(`❌ JSON inválido para meditação`, err.stack);
      throw new BadRequestException('JSON inválido no campo meditationData');
    }

    const errors = validateSync(dto, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length > 0) {
      const message = errors
        .map(err => Object.values(err.constraints ?? {}).join(', '))
        .join(' | ');
      this.logger.warn(`❌ Erros de validação: ${message}`);
      throw new BadRequestException(message);
    }

    const result = await this.updateService.update(id, { ...dto, isLocalFile: !!file }, file);
    this.logger.log(`✅ Meditação atualizada: ID=${result.id}`);
    return result;
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    this.logger.log(`🗑️ [DELETE /meditations/${id}] Excluindo meditação`);
    await this.deleteService.remove(id);
    this.logger.log(`✅ Meditação excluída: ID=${id}`);
  }
}
