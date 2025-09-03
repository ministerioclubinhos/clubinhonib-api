import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UsePipes,
  ValidationPipe,
  Logger,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { SiteFeedbackService } from './site-feedback.service';
import { CreateSiteFeedbackDto } from './dto/create-site-feedback.dto';
import { SiteFeedbackResponseDto } from './dto/site-feedback-response.dto';
import { UpdateSiteFeedbackDto } from './dto/update-site-feedback.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/auth/guards/role-guard';

@Controller('site-feedbacks')
export class SiteFeedbackController {
  private readonly logger = new Logger(SiteFeedbackController.name);

  constructor(private readonly siteFeedbackService: SiteFeedbackService) { }

  @Post()
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async create(@Body() dto: CreateSiteFeedbackDto): Promise<SiteFeedbackResponseDto> {
    this.logger.debug('📝 Recebendo requisição para criar feedback do site');
    const created = await this.siteFeedbackService.create(dto);
    this.logger.log(`✅ Feedback do site criado com ID: ${created.id}`);
    return plainToInstance(SiteFeedbackResponseDto, created);
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async findAll(): Promise<SiteFeedbackResponseDto[]> {
    this.logger.debug('📄 Buscando todos os feedbacks do site');
    const feedbacks = await this.siteFeedbackService.findAll();
    this.logger.log(`✅ Feedbacks do site encontrados: ${feedbacks.length}`);
    return plainToInstance(SiteFeedbackResponseDto, feedbacks);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async findOne(@Param('id') id: string): Promise<SiteFeedbackResponseDto> {
    this.logger.debug(`🔍 Buscando feedback do site por ID: ${id}`);
    const feedback = await this.siteFeedbackService.findOne(id);
    this.logger.log(`✅ Feedback do site encontrado: ID=${feedback.id}`);
    return plainToInstance(SiteFeedbackResponseDto, feedback);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSiteFeedbackDto,
  ): Promise<SiteFeedbackResponseDto> {
    this.logger.debug(`✏️ Atualizando feedback do site ID: ${id}`);
    const updated = await this.siteFeedbackService.update(id, dto);
    this.logger.log(`✅ Feedback do site atualizado: ID=${updated.id}`);
    return plainToInstance(SiteFeedbackResponseDto, updated);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async remove(@Param('id') id: string): Promise<void> {
    this.logger.debug(`🗑️ Removendo feedback do site ID: ${id}`);
    await this.siteFeedbackService.remove(id);
    this.logger.log(`✅ Feedback do site removido com sucesso: ID=${id}`);
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async setRead(@Param('id') id: string): Promise<SiteFeedbackResponseDto> {
    this.logger.debug(`📥 Marcando feedback do site como lido: ID=${id}`);
    const feedback = await this.siteFeedbackService.setReadOnFeedback(id);
    this.logger.log(`✅ Feedback do site marcado como lido: ID=${id}`);
    return plainToInstance(SiteFeedbackResponseDto, feedback);
  }
}
