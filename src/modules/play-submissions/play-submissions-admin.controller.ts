import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';
import { AuthRequest } from 'src/core/auth/auth.types';
import { GetPlaySubmissionsService } from './services/get-play-submissions.service';
import { ReviewPlaySubmissionService } from './services/review-play-submission.service';
import {
  ApprovePlaySubmissionDto,
  QueryPlaySubmissionsDto,
  RejectPlaySubmissionDto,
} from './dto/play-submission.dto';
import {
  PlaySubmissionResponseDto,
  PlaySubmissionsPageDto,
} from './dto/play-submission-response.dto';

/** Fila de aprovação do administrador (não depende da flag de envio). */
@Controller('play/admin/submissions')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class PlaySubmissionsAdminController {
  constructor(
    private readonly getService: GetPlaySubmissionsService,
    private readonly reviewService: ReviewPlaySubmissionService,
  ) {}

  @Get()
  list(
    @Query() query: QueryPlaySubmissionsDto,
  ): Promise<PlaySubmissionsPageDto> {
    return this.getService.findPage(query);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApprovePlaySubmissionDto,
  ): Promise<PlaySubmissionResponseDto> {
    return this.reviewService.approve(req.user.userId, id, dto);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectPlaySubmissionDto,
  ): Promise<PlaySubmissionResponseDto> {
    return this.reviewService.reject(req.user.userId, id, dto);
  }
}
