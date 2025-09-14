import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  Logger,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { plainToInstance } from 'class-transformer';
import { validateOrReject, validateSync } from 'class-validator';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventEntity } from './entities/event.entity';
import { CreateEventService } from './services/create-event-service';
import { UpdateEventService } from './services/update-event-service';
import { DeleteEventService } from './services/delete-event-service';
import { GetEventService } from './services/get-event-service';
import { EventResponseDto } from './dto/event-response-dto';

import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/auth/guards/role-guard';

@Controller('events')
export class EventController {
  private readonly logger = new Logger(EventController.name);

  constructor(
    private readonly createService: CreateEventService,
    private readonly updateService: UpdateEventService,
    private readonly deleteService: DeleteEventService,
    private readonly getService: GetEventService,
  ) {}

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body('eventData') eventDataRaw: string,
  ): Promise<EventEntity> {
    this.logger.log('📥 [POST /events] Criando novo evento');

    try {
      const parsed = JSON.parse(eventDataRaw);
      const dto = plainToInstance(CreateEventDto, parsed);
      await validateOrReject(dto, { whitelist: true, forbidNonWhitelisted: true });

      const result = await this.createService.create(dto, file);
      this.logger.log(`✅ Evento criado: ID=${result.id}`);
      return result;
    } catch (error) {
      this.logger.error('❌ Erro ao criar evento', error.stack);
      const message =
        Array.isArray(error)
          ? error.map(e => Object.values(e.constraints || {})).flat().join('; ')
          : error?.message || 'Erro ao criar evento.';
      throw new BadRequestException(message);
    }
  }

  @Get()
  async findAll(): Promise<EventResponseDto[]> {
    this.logger.log('📦 [GET /events] Listando todos os eventos');
    return this.getService.findAll();
  }

  @Get('/upcoming')
  async getUpcoming(): Promise<EventResponseDto[]> {
    this.logger.log('📅 [GET /events/upcoming] Buscando eventos futuros ou do dia');
    return this.getService.getUpcomingOrTodayEvents();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<EventResponseDto> {
    this.logger.log(`🔍 [GET /events/${id}] Buscando evento`);
    return this.getService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Patch(':id')
  @UseInterceptors(FileInterceptor('file'))
  async update(
    @Param('id') id: string,
    @Body('eventData') rawEventData: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<EventEntity> {
    this.logger.log(`✏️ [PATCH /events/${id}] Atualizando evento`);

    let dto: UpdateEventDto;
    try {
      const parsed = JSON.parse(rawEventData);
      dto = plainToInstance(UpdateEventDto, parsed);
    } catch (err) {
      this.logger.error(`❌ JSON inválido para evento`, err.stack);
      throw new BadRequestException('JSON inválido no campo eventData');
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
    this.logger.log(`✅ Evento atualizado: ID=${result.id}`);
    return result;
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    this.logger.log(`🗑️ [DELETE /events/${id}] Excluindo evento`);
    await this.deleteService.remove(id);
    this.logger.log(`✅ Evento excluído: ID=${id}`);
  }
}
