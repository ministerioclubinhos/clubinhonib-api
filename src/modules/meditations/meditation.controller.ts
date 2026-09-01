import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';

import { CreateMeditationService } from './services/create-meditation.service';
import { UpdateMeditationService } from './services/update-meditation.service';
import { DeleteMeditationService } from './services/delete-meditation.service';
import { GetMeditationService } from './services/get-meditation.service';

import { CreateMeditationDto } from './dto/create-meditation.dto';
import { UpdateMeditationDto } from './dto/update-meditation.dto';
import { MeditationResponseDto } from './dto/meditation-response.dto';
import { parseAndValidatePayload } from './utils';
import { MEDITATION_FILE_FIELD, MEDITATION_PAYLOAD_FIELD } from './constants';

@Controller('meditations')
@UseGuards(JwtAuthGuard)
export class MeditationController {
  private readonly logger = new Logger(MeditationController.name);

  constructor(
    private readonly createService: CreateMeditationService,
    private readonly updateService: UpdateMeditationService,
    private readonly deleteService: DeleteMeditationService,
    private readonly getService: GetMeditationService,
  ) {}

  @UseGuards(AdminRoleGuard)
  @Post()
  @UseInterceptors(FileInterceptor(MEDITATION_FILE_FIELD))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body(MEDITATION_PAYLOAD_FIELD) raw: string,
  ): Promise<MeditationResponseDto> {
    this.logger.debug('POST /meditations');

    const dto = await parseAndValidatePayload(raw, CreateMeditationDto);

    return this.createService.create(dto, file);
  }

  @Get()
  async findAll(): Promise<MeditationResponseDto[]> {
    this.logger.debug('GET /meditations');
    return this.getService.findAll();
  }

  @Get('this-week')
  async getThisWeek(): Promise<MeditationResponseDto | null> {
    this.logger.debug('GET /meditations/this-week');
    return this.getService.getThisWeekMeditation();
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MeditationResponseDto> {
    this.logger.debug(`GET /meditations/${id}`);
    return this.getService.findOne(id);
  }

  @UseGuards(AdminRoleGuard)
  @Patch(':id')
  @UseInterceptors(FileInterceptor(MEDITATION_FILE_FIELD))
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(MEDITATION_PAYLOAD_FIELD) raw: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<MeditationResponseDto> {
    this.logger.debug(`PATCH /meditations/${id}`);

    const dto = await parseAndValidatePayload(raw, UpdateMeditationDto);

    return this.updateService.update(id, dto, file);
  }

  @UseGuards(AdminRoleGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    this.logger.debug(`DELETE /meditations/${id}`);
    await this.deleteService.remove(id);
  }
}
