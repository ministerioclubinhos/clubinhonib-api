import {
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';
import { CreateIdeaAiEnhancementService } from './services/create-idea-ai-enhancement.service';
import { IdeaAiQueuedDto } from './dto/idea-ai-response.dto';
@Controller('ideas-sections')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class IdeasSectionAiController {
  constructor(private readonly createService: CreateIdeaAiEnhancementService) {}
  @Post(':id/ai-enhancement')
  @HttpCode(202)
  create(@Param('id', ParseUUIDPipe) id: string): Promise<IdeaAiQueuedDto> {
    return this.createService.create(id);
  }
}
