import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Sse,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthRequest } from 'src/core/auth/auth.types';
import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';
import { LessonDraftService } from '../services/lesson-draft.service';
import { GenerateLessonRequestDto } from '../dto/generate-lesson-request.dto';
import {
  ApproveStageRequestDto,
  CompleteStageRequestDto,
  GenerateStageRequestDto,
  LessonViewQueryDto,
  PreviewStagePdfQueryDto,
  ReopenStageRequestDto,
  RequestStageChangesDto,
} from '../dto/generate-stage-request.dto';
import { LessonEventStreamService } from '../services/lesson-event-stream.service';
import { SaveTiptapContentDto } from '../dto/save-tiptap-content.dto';
import { LessonStageType } from '../enums/lesson.enums';
import { AdminLessonPromptService } from '../services/admin-lesson-prompt.service';
import {
  ResetAdminLessonPromptDto,
  ListAdminLessonPromptsQueryDto,
  SaveAdminLessonPromptDto,
} from '../dto/admin-lesson-prompt.dto';
import { QueryLessonsDto } from '../dto/query-lessons.dto';
import {
  LessonDashboardResponseDto,
  LessonDeleteResponseDto,
  LessonListResponseDto,
  LessonPublicationResponseDto,
  LessonResponseDto,
  toLessonResponse,
} from '../dto/lesson-response.dto';

@Controller('api/v1/lessons')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AiLessonsController {
  constructor(
    private readonly service: LessonDraftService,
    private readonly prompts: AdminLessonPromptService,
    private readonly eventStream: LessonEventStreamService,
  ) {}
  @Get('prompt-preferences/me') promptPreferences(
    @Req() req: AuthRequest,
    @Query() query: ListAdminLessonPromptsQueryDto,
  ) {
    return this.prompts.list(req.user.userId, query.category);
  }
  @Patch('prompt-preferences/me') savePrompt(
    @Body() dto: SaveAdminLessonPromptDto,
    @Req() req: AuthRequest,
  ) {
    return this.prompts.save(
      req.user.userId,
      dto.stage,
      dto.prompt,
      dto.lockVersion,
      dto.category,
    );
  }
  @Post('prompt-preferences/me/reset') resetPrompt(
    @Body() dto: ResetAdminLessonPromptDto,
    @Req() req: AuthRequest,
  ) {
    return this.prompts.reset(
      req.user.userId,
      dto.stage,
      dto.lockVersion,
      dto.category,
    );
  }
  @Post() @HttpCode(HttpStatus.CREATED) async create(
    @Body() dto: GenerateLessonRequestDto,
    @Req() req: AuthRequest,
  ): Promise<LessonResponseDto> {
    return toLessonResponse(await this.service.create(dto, req.user.userId));
  }
  @Get('dashboard') async dashboard(): Promise<LessonDashboardResponseDto> {
    const result = await this.service.getDashboard();
    return {
      ...result,
      recent: result.recent.map((lesson) => toLessonResponse(lesson)),
    };
  }
  @Get() async list(
    @Query() query: QueryLessonsDto,
  ): Promise<LessonListResponseDto> {
    const result = await this.service.getDrafts(query);
    return {
      ...result,
      items: result.items.map((lesson) => toLessonResponse(lesson)),
    };
  }
  @Get(':id') async get(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: LessonViewQueryDto = {},
  ): Promise<LessonResponseDto> {
    return toLessonResponse(await this.service.getById(id), {
      view: query.view,
    });
  }
  @Sse(':id/events') events(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
    @Query() query: LessonViewQueryDto = {},
  ): Observable<MessageEvent> {
    return this.eventStream.stream(id, req.user.userId, query.view);
  }
  @Delete(':id') @HttpCode(HttpStatus.OK) delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
  ): Promise<LessonDeleteResponseDto> {
    return this.service.delete(id, req.user.userId);
  }
  @Post(':id/archive') @HttpCode(HttpStatus.OK) async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
  ): Promise<LessonResponseDto> {
    return toLessonResponse(await this.service.archive(id, req.user.userId));
  }
  @Post(':id/unarchive') @HttpCode(HttpStatus.OK) async unarchive(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
  ): Promise<LessonResponseDto> {
    return toLessonResponse(await this.service.unarchive(id, req.user.userId));
  }
  @Post(':id/comments/:commentId/resolve')
  @HttpCode(HttpStatus.OK)
  async resolveComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Req() req: AuthRequest,
  ): Promise<LessonResponseDto> {
    return toLessonResponse(
      await this.service.resolveComment(id, commentId, req.user.userId),
    );
  }
  @Post(':id/stages/generate') async generate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GenerateStageRequestDto,
    @Req() req: AuthRequest,
  ): Promise<LessonResponseDto> {
    return toLessonResponse(
      await this.service.generateStage(id, dto, req.user.userId),
    );
  }
  @Patch(':id/stages/content') async save(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveTiptapContentDto,
    @Req() req: AuthRequest,
  ): Promise<LessonResponseDto> {
    return toLessonResponse(
      await this.service.saveContent(id, dto, req.user.userId),
    );
  }
  @Post(':id/stages/complete-production') async completeProduction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteStageRequestDto,
    @Req() req: AuthRequest,
  ): Promise<LessonResponseDto> {
    return toLessonResponse(
      await this.service.completeProductionStage(
        id,
        dto.stage,
        dto.lockVersion,
        {
          acknowledgeStale: dto.acknowledgeStale,
          actorId: req.user.userId,
        },
      ),
    );
  }
  @Post(':id/package/submit-review') async submitPackage(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
  ): Promise<LessonResponseDto> {
    return toLessonResponse(
      await this.service.submitPackageReview(id, req.user.userId),
    );
  }
  @Post(':id/stages/approve') async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveStageRequestDto,
    @Req() req: AuthRequest,
  ): Promise<LessonResponseDto> {
    return toLessonResponse(
      await this.service.approveStage(
        id,
        dto.stage,
        req.user.userId,
        dto.lockVersion,
      ),
    );
  }
  @Post(':id/stages/request-changes') async requestChanges(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestStageChangesDto,
    @Req() req: AuthRequest,
  ): Promise<LessonResponseDto> {
    return toLessonResponse(
      await this.service.requestChanges(
        id,
        dto.stage,
        dto.note,
        req.user.userId,
        dto.lockVersion,
      ),
    );
  }
  @Post(':id/stages/reopen') @HttpCode(HttpStatus.OK) async reopen(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReopenStageRequestDto,
    @Req() req: AuthRequest,
  ): Promise<LessonResponseDto> {
    return toLessonResponse(
      await this.service.reopenStage(
        id,
        dto.stage,
        dto.note,
        req.user.userId,
        dto.lockVersion,
      ),
    );
  }
  @Post(':id/export/pdf')
  @Header('Content-Type', 'application/pdf')
  async exportPdf(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StreamableFile> {
    const result = await this.service.exportPdf(id);
    return new StreamableFile(result.pdfBuffer, {
      disposition: `attachment; filename="${result.fileName}"`,
      type: 'application/pdf',
    });
  }
  @Get(':id/stages/:stage/preview.pdf')
  @Header('Content-Type', 'application/pdf')
  async previewStage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stage', new ParseEnumPipe(LessonStageType)) stage: LessonStageType,
    @Query() query?: PreviewStagePdfQueryDto,
  ): Promise<StreamableFile> {
    const result = await this.service.previewStagePdf(
      id,
      stage,
      query?.lockVersion,
      query?.versionId,
    );
    return new StreamableFile(result.pdfBuffer, {
      disposition: `inline; filename="${result.fileName}"`,
      type: 'application/pdf',
    });
  }
  @Post(':id/publish-week-material') async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
  ): Promise<LessonPublicationResponseDto> {
    const result = await this.service.publishToWeekMaterial(
      id,
      req.user.userId,
    );
    return {
      lesson: toLessonResponse(result.lesson),
      weekMaterialId: result.weekMaterialId,
    };
  }
}
