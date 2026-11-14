import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';
import { CreateIdeaAiEnhancementService } from './services/create-idea-ai-enhancement.service';
import { UpdateIdeaAiEnhancementService } from './services/update-idea-ai-enhancement.service';
import { IdeaAiQueuedDto } from './dto/idea-ai-response.dto';
import { CreateIdeaAiEnhancementDto } from './dto/create-idea-ai-enhancement.dto';
@Controller('ideas-sections')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class IdeasSectionAiController {
  constructor(
    private readonly createService: CreateIdeaAiEnhancementService,
    private readonly updateService: UpdateIdeaAiEnhancementService,
  ) {}

  /** Corpo vazio refaz tudo; `scope`, `mediaIds` e `instructions` dirigem a regeneração. */
  @Post(':id/ai-enhancement')
  @HttpCode(202)
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateIdeaAiEnhancementDto,
  ): Promise<IdeaAiQueuedDto> {
    return this.createService.create(id, body);
  }

  /** Registrada antes de `:enhancementId` para não ser capturada por ela. */
  @Delete(':id/ai-enhancement/active')
  @HttpCode(204)
  async cancel(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.updateService.cancel(id);
  }

  @Patch(':id/ai-enhancement/:enhancementId/current')
  @HttpCode(204)
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('enhancementId', ParseUUIDPipe) enhancementId: string,
  ): Promise<void> {
    await this.updateService.restore(id, enhancementId);
  }
}
