import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';
import { IdeaAiEnabledGuard } from './guards/idea-ai-enabled.guard';
import { CreateIdeaAiEnhancementService } from './services/create-idea-ai-enhancement.service';
import { UpdateIdeaAiEnhancementService } from './services/update-idea-ai-enhancement.service';
import { GetIdeaAiDocumentService } from './services/get-idea-ai-document.service';
import { UpdateIdeaAiDocumentService } from './services/update-idea-ai-document.service';
import { SaveIdeaAiDocumentDto } from './dto/save-idea-ai-document.dto';
import { IdeaAiDocumentDto, IdeaAiQueuedDto } from './dto/idea-ai-response.dto';
import { CreateIdeaAiEnhancementDto } from './dto/create-idea-ai-enhancement.dto';
@Controller('ideas-sections')
@UseGuards(JwtAuthGuard, AdminRoleGuard, IdeaAiEnabledGuard)
export class IdeasSectionAiController {
  constructor(
    private readonly createService: CreateIdeaAiEnhancementService,
    private readonly updateService: UpdateIdeaAiEnhancementService,
    private readonly getDocumentService: GetIdeaAiDocumentService,
    private readonly updateDocumentService: UpdateIdeaAiDocumentService,
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

  /** Documento melhorado, no formato do editor, para edição manual. */
  @Get(':id/ai-enhancement/medias/:sourceMediaId/document')
  getDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sourceMediaId', ParseUUIDPipe) sourceMediaId: string,
  ): Promise<IdeaAiDocumentDto> {
    return this.getDocumentService.get(id, sourceMediaId);
  }

  /** Salva a edição e gera o DOCX e o PDF novos a partir do conteúdo do editor. */
  @Put(':id/ai-enhancement/medias/:sourceMediaId/document')
  saveDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sourceMediaId', ParseUUIDPipe) sourceMediaId: string,
    @Body() body: SaveIdeaAiDocumentDto,
  ): Promise<IdeaAiDocumentDto> {
    return this.updateDocumentService.save(id, sourceMediaId, body);
  }
}
