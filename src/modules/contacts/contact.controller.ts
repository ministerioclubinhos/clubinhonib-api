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
  Query,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';
import { Paginated } from 'src/shared/dto/paginated.dto';

import { CreateContactDto } from './dto/create-contact.dto';
import { QueryContactsDto } from './dto/query-contacts.dto';
import { ContactResponseDto } from './dto/contact-response.dto';
import { CreateContactService } from './services/create-contact.service';
import { GetContactsService } from './services/get-contacts.service';
import { UpdateContactService } from './services/update-contact.service';
import { DeleteContactService } from './services/delete-contact.service';

@Controller('contact')
export class ContactController {
  private readonly logger = new Logger(ContactController.name);

  constructor(
    private readonly createService: CreateContactService,
    private readonly getService: GetContactsService,
    private readonly updateService: UpdateContactService,
    private readonly deleteService: DeleteContactService,
  ) {}

  /** Formulário público do site. */
  @Post()
  async create(@Body() dto: CreateContactDto): Promise<ContactResponseDto> {
    this.logger.debug('POST /contact');
    return this.createService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async findAllPaginated(
    @Query() query: QueryContactsDto,
  ): Promise<Paginated<ContactResponseDto>> {
    this.logger.debug('GET /contact');
    return this.getService.findAllPaginated(query);
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async countUnread(): Promise<{ unread: number }> {
    return this.getService.countUnread();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ContactResponseDto> {
    return this.getService.findOne(id);
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async setRead(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ContactResponseDto> {
    this.logger.debug(`PATCH /contact/${id}/read`);
    return this.updateService.setRead(id, true);
  }

  @Patch(':id/unread')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async setUnread(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ContactResponseDto> {
    this.logger.debug(`PATCH /contact/${id}/unread`);
    return this.updateService.setRead(id, false);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    this.logger.debug(`DELETE /contact/${id}`);
    return this.deleteService.remove(id);
  }
}
