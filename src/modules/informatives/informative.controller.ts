import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  Body,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { Paginated } from 'src/shared/dto/paginated.dto';
import { CreateInformativeDto } from './dto/create-informative.dto';
import { QueryInformativesDto } from './dto/query-informatives.dto';
import { UpdateInformativeDto } from './dto/update-informative.dto';
import { InformativeResponseDto } from './dto/informative-response.dto';
import { CreateInformativeService } from './services/create-informative.service';
import { GetInformativeService } from './services/get-informative.service';
import { UpdateInformativeService } from './services/update-informative.service';
import { DeleteInformativeService } from './services/delete-informative.service';

import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';

@Controller('informatives')
export class InformativeController {
  private readonly logger = new Logger(InformativeController.name);

  constructor(
    private readonly createService: CreateInformativeService,
    private readonly getService: GetInformativeService,
    private readonly updateService: UpdateInformativeService,
    private readonly deleteService: DeleteInformativeService,
  ) {}

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post()
  async create(
    @Body() dto: CreateInformativeDto,
  ): Promise<InformativeResponseDto> {
    this.logger.log('📥 [POST /informatives] Criando banner informativo');
    const result = await this.createService.createInformative(dto);
    this.logger.log(`✅ Banner criado com ID: ${result.id}`);
    return result;
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Query() query: QueryInformativesDto,
  ): Promise<Paginated<InformativeResponseDto>> {
    this.logger.log('📄 [GET /informatives] Listando banners');
    return this.getService.findAllPaginated(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InformativeResponseDto> {
    this.logger.log(`🔎 [GET /informatives/${id}] Buscando banner`);
    return this.getService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInformativeDto,
  ): Promise<InformativeResponseDto> {
    this.logger.log(`✏️ [PATCH /informatives/${id}] Atualizando banner`);
    const result = await this.updateService.execute(id, dto);
    this.logger.log(`✅ Banner atualizado com sucesso: ID=${id}`);
    return result;
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    this.logger.log(`🗑️ [DELETE /informatives/${id}] Removendo banner`);
    await this.deleteService.execute(id);
    this.logger.log(`✅ Banner removido: ID=${id}`);
  }
}
