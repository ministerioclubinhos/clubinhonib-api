import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AuthRequest } from 'src/core/auth/auth.types';
import { Paginated } from 'src/shared/dto/paginated.dto';
import { GetPlayVideosService } from './services/get-play-videos.service';
import { PlayEngagementService } from './services/play-engagement.service';
import { QueryPlayVideosDto } from './dto/query-play-videos.dto';
import {
  QueryPlayRelatedDto,
  SavePlayProgressDto,
} from './dto/play-engagement.dto';
import {
  PlayCategoryResponseDto,
  PlayHomeResponseDto,
  PlayVideoResponseDto,
} from './dto/play-video-response.dto';

/** Clubinho Play para qualquer perfil logado, sujeito à flag `clubinho_play`. */
@Controller('play')
@UseGuards(JwtAuthGuard)
export class PlayController {
  private readonly logger = new Logger(PlayController.name);

  constructor(
    private readonly getService: GetPlayVideosService,
    private readonly engagement: PlayEngagementService,
  ) {}

  @Get('home')
  home(@Req() req: AuthRequest): Promise<PlayHomeResponseDto> {
    this.logger.debug('GET /play/home');
    return this.getService.findHome(req.user.userId);
  }

  @Get('categories')
  categories(): Promise<PlayCategoryResponseDto[]> {
    return this.getService.listCategories();
  }

  @Get('videos')
  findAll(
    @Req() req: AuthRequest,
    @Query() query: QueryPlayVideosDto,
  ): Promise<Paginated<PlayVideoResponseDto>> {
    this.logger.debug('GET /play/videos');
    return this.getService.findAll(req.user.userId, query);
  }

  /** Fila completa (sem paginação) com os mesmos filtros da listagem. */
  @Get('queue')
  queue(
    @Req() req: AuthRequest,
    @Query() query: QueryPlayVideosDto,
  ): Promise<PlayVideoResponseDto[]> {
    return this.getService.findQueue(req.user.userId, query);
  }

  @Get('videos/:id')
  findOne(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PlayVideoResponseDto> {
    return this.getService.findOne(req.user.userId, id);
  }

  @Get('videos/:id/related')
  related(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryPlayRelatedDto,
  ): Promise<PlayVideoResponseDto[]> {
    return this.getService.findRelated(req.user.userId, id, query.limit);
  }

  @Post('videos/:id/view')
  @HttpCode(HttpStatus.OK)
  view(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ counted: boolean }> {
    return this.engagement.recordView(req.user.userId, id);
  }

  @Put('videos/:id/progress')
  @HttpCode(HttpStatus.NO_CONTENT)
  async progress(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SavePlayProgressDto,
  ): Promise<void> {
    await this.engagement.saveProgress(req.user.userId, id, dto);
  }

  @Put('videos/:id/favorite')
  @HttpCode(HttpStatus.NO_CONTENT)
  async favorite(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.engagement.setFavorite(req.user.userId, id, true);
  }

  @Delete('videos/:id/favorite')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unfavorite(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.engagement.setFavorite(req.user.userId, id, false);
  }
}
