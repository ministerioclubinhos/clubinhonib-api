import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';

import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';

import { WeekMaterialsPageResponseDTO } from './dto/week-material-response.dto';
import { CreateWeekMaterialsPageDto } from './dto/create-week-material.dto';
import { UpdateWeekMaterialsPageDto } from './dto/update-week-material.dto';
import { WeekMaterialsPageCreateService } from './services/create-week-material.service';
import { WeekMaterialsPageUpdateService } from './services/update-week-material.service';
import { WeekMaterialsPageGetService } from './services/get-week-material.service';
import { WeekMaterialsPageRemoveService } from './services/delete-week-material.service';
import { buildFilesDict, parseAndValidatePayload } from './utils';
import { WEEK_MATERIAL_PAYLOAD_FIELD } from './constants';

@Controller('week-material-pages')
@UseGuards(JwtAuthGuard)
export class WeekMaterialsPageController {
  private readonly logger = new Logger(WeekMaterialsPageController.name);

  constructor(
    private readonly createService: WeekMaterialsPageCreateService,
    private readonly updateService: WeekMaterialsPageUpdateService,
    private readonly removeService: WeekMaterialsPageRemoveService,
    private readonly getService: WeekMaterialsPageGetService,
  ) {}

  @UseGuards(AdminRoleGuard)
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body(WEEK_MATERIAL_PAYLOAD_FIELD) raw: string,
  ): Promise<WeekMaterialsPageResponseDTO> {
    this.logger.debug('POST /week-material-pages');

    const dto = await parseAndValidatePayload(raw, CreateWeekMaterialsPageDto);

    return this.createService.createWeekMaterialsPage(
      dto,
      buildFilesDict(files),
    );
  }

  @UseGuards(AdminRoleGuard)
  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body(WEEK_MATERIAL_PAYLOAD_FIELD) raw: string,
  ): Promise<WeekMaterialsPageResponseDTO> {
    this.logger.debug(`PATCH /week-material-pages/${id}`);

    const dto = await parseAndValidatePayload(raw, UpdateWeekMaterialsPageDto);

    return this.updateService.updateWeekMaterialsPage(
      id,
      dto,
      buildFilesDict(files),
    );
  }

  @UseGuards(AdminRoleGuard)
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    this.logger.debug(`DELETE /week-material-pages/${id}`);
    await this.removeService.removeWeekMaterial(id);
  }

  @Get()
  async findAll(): Promise<WeekMaterialsPageResponseDTO[]> {
    this.logger.debug('GET /week-material-pages');
    return this.getService.findAllPagesWithMedia();
  }

  @Get('current-week')
  async getCurrentWeek(): Promise<WeekMaterialsPageResponseDTO | null> {
    this.logger.debug('GET /week-material-pages/current-week');
    return this.getService.getCurrentWeek();
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WeekMaterialsPageResponseDTO> {
    this.logger.debug(`GET /week-material-pages/${id}`);
    return this.getService.findPageWithMedia(id);
  }

  @UseGuards(AdminRoleGuard)
  @Post('current-week/:id')
  async setCurrentWeek(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WeekMaterialsPageResponseDTO> {
    this.logger.debug(`POST /week-material-pages/current-week/${id}`);
    return this.updateService.setCurrentWeek(id);
  }
}
