import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UsePipes,
  ValidationPipe,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentResponseDto } from './dto/comment-response.dto';
import { plainToInstance } from 'class-transformer';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RoleGuard } from 'src/auth/guards/role-guard';

@Controller('comments')
export class CommentController {
  private readonly logger = new Logger(CommentController.name);

  constructor(private readonly commentService: CommentService) { }

  @Post()
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async create(@Body() dto: CreateCommentDto): Promise<CommentResponseDto> {
    this.logger.debug('📝 Recebendo requisição para criar comentário');
    const created = await this.commentService.create(dto);
    this.logger.log(`✅ Comentário criado com ID: ${created.id}`);
    return plainToInstance(CommentResponseDto, created);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RoleGuard)
  async findAll(): Promise<CommentResponseDto[]> {
    this.logger.debug('📄 Buscando todos os comentários');
    const comments = await this.commentService.findAll();
    this.logger.log(`✅ Comentários encontrados: ${comments.length}`);
    return plainToInstance(CommentResponseDto, comments);
  }

  @Get('/published')
  async findAllPublished(): Promise<CommentResponseDto[]> {
    this.logger.debug('📄 Buscando comentários publicados');
    const comments = await this.commentService.findAllPublished();
    this.logger.log(`✅ Comentários publicados: ${comments.length}`);
    return plainToInstance(CommentResponseDto, comments);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RoleGuard)
  async findOne(@Param('id') id: string): Promise<CommentResponseDto> {
    this.logger.debug(`🔍 Buscando comentário por ID: ${id}`);
    const comment = await this.commentService.findOne(id);
    this.logger.log(`✅ Comentário encontrado: ID=${comment.id}`);
    return plainToInstance(CommentResponseDto, comment);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RoleGuard)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto,
  ): Promise<CommentResponseDto> {
    this.logger.debug(`✏️ Atualizando comentário ID: ${id}`);
    const updated = await this.commentService.update(id, dto);
    this.logger.log(`✅ Comentário atualizado: ID=${updated.id}`);
    return plainToInstance(CommentResponseDto, updated);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RoleGuard)
  async remove(@Param('id') id: string): Promise<void> {
    this.logger.debug(`🗑️ Removendo comentário ID: ${id}`);
    await this.commentService.remove(id);
    this.logger.log(`✅ Comentário removido com sucesso: ID=${id}`);
  }
}
