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
import {
  Observable,
  defer,
  from,
  interval,
  map,
  startWith,
  switchMap,
  take,
} from 'rxjs';
import { AuthRequest } from 'src/core/auth/auth.types';
import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';
import { LessonDraftService } from '../services/lesson-draft.service';
import { GenerateLessonRequestDto } from '../dto/generate-lesson-request.dto';
import {
  GenerateStageRequestDto,
  PreviewStagePdfQueryDto,
  ReviewStageRequestDto,
} from '../dto/generate-stage-request.dto';
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
  LessonListResponseDto,
  LessonPublicationResponseDto,
  LessonResponseDto,
  computeLessonEventDigest,
  toLessonResponse,
} from '../dto/lesson-response.dto';

const SSE_MAX_TICKS_PER_CONNECTION = 90;

@Controller('api/v1/lessons')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AiLessonsController {
  constructor(
    private readonly service: LessonDraftService,
    private readonly prompts: AdminLessonPromptService,
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
    @Query('view') view?: 'full' | 'compact',
  ): Promise<LessonResponseDto> {
    const normalizedView = view === 'compact' ? 'compact' : 'full';
    return toLessonResponse(await this.service.getById(id), {
      view: normalizedView,
    });
  }
  @Sse(':id/events') events(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('view') view?: 'full' | 'compact',
  ): Observable<MessageEvent> {
    const normalizedView = view === 'compact' ? 'compact' : 'full';
    return defer(() => {
      let lastDigest: string | null = null;
      return interval(2000).pipe(
        startWith(0),
        take(SSE_MAX_TICKS_PER_CONNECTION),
        switchMap(() => from(this.service.getById(id))),
        map((lesson): MessageEvent => {
          const nextDigest = computeLessonEventDigest(lesson);
          if (lastDigest === nextDigest) {
            return {
              type: 'heartbeat',
              data: { type: 'heartbeat', timestamp: new Date().toISOString() },
            };
          }
          lastDigest = nextDigest;
          return {
            data: toLessonResponse(lesson, { view: normalizedView }),
          };
        }),
      );
    });
  }
  @Delete(':id') @HttpCode(HttpStatus.OK) delete(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.delete(id);
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
    @Body() dto: ReviewStageRequestDto,
  ): Promise<LessonResponseDto> {
    return toLessonResponse(
      await this.service.completeProductionStage(
        id,
        dto.stage,
        dto.lockVersion,
      ),
    );
  }
  @Post(':id/package/submit-review') async submitPackage(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LessonResponseDto> {
    return toLessonResponse(await this.service.submitPackageReview(id));
  }
  @Post(':id/stages/approve') async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewStageRequestDto,
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
    @Body() dto: ReviewStageRequestDto,
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
  ): Promise<LessonPublicationResponseDto> {
    const result = await this.service.publishToWeekMaterial(id);
    return {
      lesson: toLessonResponse(result.lesson),
      weekMaterialId: result.weekMaterialId,
    };
  }
}
