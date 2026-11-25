import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AuthRequest } from 'src/core/auth/auth.types';
import { parseAndValidatePayload } from 'src/shared/media/payload-validation';
import { CreatePlaySubmissionService } from './services/create-play-submission.service';
import { GetPlaySubmissionsService } from './services/get-play-submissions.service';
import { DeletePlaySubmissionService } from './services/delete-play-submission.service';
import { CreatePlaySubmissionDto } from './dto/play-submission.dto';
import { PlaySubmissionResponseDto } from './dto/play-submission-response.dto';
import {
  PLAY_SUBMISSION_LABELS,
  PLAY_SUBMISSION_PAYLOAD_FIELD,
  PLAY_SUBMISSION_THUMBNAIL_FIELD,
  PLAY_SUBMISSION_UPLOAD_LIMITS,
  PLAY_SUBMISSION_VIDEO_FIELD,
} from './constants';

/** Envio de vídeos ao Clubinho Play: qualquer perfil logado, sob a flag `play_submissions`. */
@Controller('play/submissions')
@UseGuards(JwtAuthGuard)
export class PlaySubmissionsController {
  constructor(
    private readonly createService: CreatePlaySubmissionService,
    private readonly getService: GetPlaySubmissionsService,
    private readonly deleteService: DeletePlaySubmissionService,
  ) {}

  @Post()
  @UseInterceptors(
    AnyFilesInterceptor({ limits: PLAY_SUBMISSION_UPLOAD_LIMITS }),
  )
  async create(
    @Req() req: AuthRequest,
    @UploadedFiles() files: Express.Multer.File[],
    @Body(PLAY_SUBMISSION_PAYLOAD_FIELD) raw: string,
  ): Promise<PlaySubmissionResponseDto> {
    const dto = await parseAndValidatePayload(
      raw,
      CreatePlaySubmissionDto,
      PLAY_SUBMISSION_PAYLOAD_FIELD,
      PLAY_SUBMISSION_LABELS,
    );
    const byField = (name: string) =>
      files?.find((file) => file.fieldname === name);
    return this.createService.execute(
      req.user.userId,
      dto,
      byField(PLAY_SUBMISSION_VIDEO_FIELD),
      byField(PLAY_SUBMISSION_THUMBNAIL_FIELD),
    );
  }

  @Get('mine')
  mine(@Req() req: AuthRequest): Promise<PlaySubmissionResponseDto[]> {
    return this.getService.findMine(req.user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async withdraw(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.deleteService.withdraw(req.user.userId, id);
  }
}
