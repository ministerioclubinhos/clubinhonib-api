import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';
import { GetPlayVideosService } from './services/get-play-videos.service';
import { PlayCategoriesService } from './services/play-categories.service';
import {
  QueryPlayStatsDto,
  SavePlayCategoryDto,
} from './dto/play-engagement.dto';
import {
  PlayCategoryResponseDto,
  PlayStatsResponseDto,
} from './dto/play-video-response.dto';

/** Administração do Clubinho Play: categorias e estatísticas. */
@Controller('play/admin')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class PlayAdminController {
  constructor(
    private readonly getService: GetPlayVideosService,
    private readonly categories: PlayCategoriesService,
  ) {}

  @Get('stats')
  stats(@Query() query: QueryPlayStatsDto): Promise<PlayStatsResponseDto> {
    return this.getService.stats(query.limit);
  }

  @Get('galleries')
  galleries(): Promise<{ id: string; title: string; scope: string }[]> {
    return this.getService.listPlayGalleries();
  }

  @Post('categories')
  createCategory(
    @Body() dto: SavePlayCategoryDto,
  ): Promise<PlayCategoryResponseDto> {
    return this.categories.create(dto);
  }

  @Patch('categories/:id')
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SavePlayCategoryDto,
  ): Promise<PlayCategoryResponseDto> {
    return this.categories.update(id, dto);
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeCategory(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.categories.remove(id);
  }
}
