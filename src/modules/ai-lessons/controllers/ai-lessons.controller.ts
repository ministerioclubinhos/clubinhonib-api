import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, ParseEnumPipe, ParseUUIDPipe, Patch, Post, Query, Req, StreamableFile, UseGuards } from '@nestjs/common';
import { AuthRequest } from 'src/core/auth/auth.types';
import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';
import { LessonDraftService } from '../services/lesson-draft.service';
import { GenerateLessonRequestDto } from '../dto/generate-lesson-request.dto';
import { GenerateStageRequestDto, ReviewStageRequestDto } from '../dto/generate-stage-request.dto';
import { SaveTiptapContentDto } from '../dto/save-tiptap-content.dto';
import { LessonStageType, LessonStatus } from '../enums/lesson.enums';
import { AdminLessonPromptService } from '../services/admin-lesson-prompt.service';
import { ResetAdminLessonPromptDto, SaveAdminLessonPromptDto } from '../dto/admin-lesson-prompt.dto';

@Controller('api/v1/lessons')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AiLessonsController {
  constructor(private readonly service: LessonDraftService, private readonly prompts: AdminLessonPromptService) {}
  @Get('prompt-preferences/me') promptPreferences(@Req() req: AuthRequest) { return this.prompts.list(req.user.userId); }
  @Patch('prompt-preferences/me') savePrompt(@Body() dto: SaveAdminLessonPromptDto, @Req() req: AuthRequest) { return this.prompts.save(req.user.userId, dto.stage, dto.prompt, dto.lockVersion); }
  @Post('prompt-preferences/me/reset') resetPrompt(@Body() dto: ResetAdminLessonPromptDto, @Req() req: AuthRequest) { return this.prompts.reset(req.user.userId, dto.stage); }
  @Post() @HttpCode(HttpStatus.CREATED) create(@Body() dto: GenerateLessonRequestDto, @Req() req: AuthRequest) { return this.service.create(dto, req.user.userId); }
  @Get('dashboard') dashboard() { return this.service.getDashboard(); }
  @Get() list(@Query('status') status?: LessonStatus, @Query('page') page?: number, @Query('limit') limit?: number) { return this.service.getDrafts(status, page, limit); }
  @Get(':id') get(@Param('id', ParseUUIDPipe) id: string) { return this.service.getById(id); }
  @Post(':id/stages/generate') generate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: GenerateStageRequestDto, @Req() req: AuthRequest) { return this.service.generateStage(id, dto, req.user.userId); }
  @Patch(':id/stages/content') save(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveTiptapContentDto, @Req() req: AuthRequest) { return this.service.saveContent(id, dto, req.user.userId); }
  @Post(':id/stages/complete-production') completeProduction(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewStageRequestDto) { return this.service.completeProductionStage(id, dto.stage); }
  @Post(':id/package/submit-review') submitPackage(@Param('id', ParseUUIDPipe) id: string) { return this.service.submitPackageReview(id); }
  @Post(':id/stages/approve') approve(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewStageRequestDto, @Req() req: AuthRequest) { return this.service.approveStage(id, dto.stage, req.user.userId); }
  @Post(':id/stages/request-changes') requestChanges(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewStageRequestDto) { return this.service.requestChanges(id, dto.stage); }
  @Post(':id/export/pdf') @Header('Content-Type', 'application/pdf') async exportPdf(@Param('id', ParseUUIDPipe) id: string): Promise<StreamableFile> { const result = await this.service.exportPdf(id); return new StreamableFile(result.pdfBuffer, { disposition: `attachment; filename="${result.fileName}"`, type: 'application/pdf' }); }
  @Get(':id/stages/:stage/preview.pdf') @Header('Content-Type', 'application/pdf') async previewStage(@Param('id', ParseUUIDPipe) id: string, @Param('stage', new ParseEnumPipe(LessonStageType)) stage: LessonStageType): Promise<StreamableFile> { const result = await this.service.previewStagePdf(id, stage); return new StreamableFile(result.pdfBuffer, { disposition: `inline; filename="${result.fileName}"`, type: 'application/pdf' }); }
  @Post(':id/publish-week-material') publish(@Param('id', ParseUUIDPipe) id: string) { return this.service.publishToWeekMaterial(id); }
}
