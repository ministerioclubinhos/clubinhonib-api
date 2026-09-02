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
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';

import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';
import { AuthContextService } from 'src/core/auth/services/auth-context.service';

import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventResponseDto } from './dto/event-response.dto';
import { CreateEventService } from './services/create-event.service';
import { UpdateEventService } from './services/update-event.service';
import { DeleteEventService } from './services/delete-event.service';
import { GetEventService } from './services/get-event.service';
import { parseAndValidatePayload } from './utils';
import { EVENT_FILE_FIELD, EVENT_PAYLOAD_FIELD } from './constants';

@Controller('events')
export class EventController {
  private readonly logger = new Logger(EventController.name);

  constructor(
    private readonly createService: CreateEventService,
    private readonly updateService: UpdateEventService,
    private readonly deleteService: DeleteEventService,
    private readonly getService: GetEventService,
    private readonly authContext: AuthContextService,
  ) {}

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post()
  @UseInterceptors(FileInterceptor(EVENT_FILE_FIELD))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body(EVENT_PAYLOAD_FIELD) raw: string,
  ): Promise<EventResponseDto> {
    this.logger.debug('POST /events');

    const dto = await parseAndValidatePayload(raw, CreateEventDto);

    return this.createService.create(dto, file);
  }

  @Get()
  async findAll(@Req() request: Request): Promise<EventResponseDto[]> {
    this.logger.debug('GET /events');

    // Ler a sessão é transporte; a regra de visibilidade fica no caso de uso,
    // que recebe apenas o booleano.
    return this.getService.findAll(await this.authContext.isLoggedIn(request));
  }

  @Get('upcoming')
  async findUpcoming(@Req() request: Request): Promise<EventResponseDto[]> {
    this.logger.debug('GET /events/upcoming');
    return this.getService.findUpcoming(
      await this.authContext.isLoggedIn(request),
    );
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EventResponseDto> {
    this.logger.debug(`GET /events/${id}`);
    return this.getService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Patch(':id')
  @UseInterceptors(FileInterceptor(EVENT_FILE_FIELD))
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(EVENT_PAYLOAD_FIELD) raw: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<EventResponseDto> {
    this.logger.debug(`PATCH /events/${id}`);

    const dto = await parseAndValidatePayload(raw, UpdateEventDto);

    return this.updateService.update(id, dto, file);
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    this.logger.debug(`DELETE /events/${id}`);
    await this.deleteService.remove(id);
  }
}
