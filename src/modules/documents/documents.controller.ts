import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFiles,
  Logger,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';

import { Paginated } from 'src/shared/dto/paginated.dto';

import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import { DocumentResponseDto } from './dto/document-response.dto';

import { CreateDocumentService } from './services/create-document.service';
import { UpdateDocumentService } from './services/update-document.service';
import { GetDocumentService } from './services/get-document.service';
import { DeleteDocumentService } from './services/delete-document.service';

import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';

import { findMediaFile, parseAndValidatePayload } from './utils';
import { DOCUMENT_PAYLOAD_FIELD } from './constants';

@Controller('documents')
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(
    private readonly createService: CreateDocumentService,
    private readonly updateService: UpdateDocumentService,
    private readonly getService: GetDocumentService,
    private readonly deleteService: DeleteDocumentService,
  ) {}

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body(DOCUMENT_PAYLOAD_FIELD) raw?: string,
  ): Promise<DocumentResponseDto> {
    this.logger.log('📥 [POST /documents] Criando novo documento');

    const dto = await parseAndValidatePayload(raw, CreateDocumentDto);
    const file = findMediaFile(files, dto.media?.fileField);

    if (dto.media?.fileField && !file) {
      this.logger.warn(
        `⚠️ Nenhum arquivo encontrado com fieldname: ${dto.media.fileField}`,
      );
    }

    const result = await this.createService.createDocument(dto, file);
    this.logger.log('✅ Documento criado com sucesso');
    return result;
  }

  /**
   * Listagem do painel. Exige sessão: é o inventário administrativo dos
   * documentos.
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  async findAllPaginated(
    @Query() query: QueryDocumentsDto,
  ): Promise<Paginated<DocumentResponseDto>> {
    this.logger.debug('GET /documents');
    return this.getService.findAllPaginated(query);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DocumentResponseDto> {
    return this.getService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body(DOCUMENT_PAYLOAD_FIELD) raw?: string,
  ): Promise<DocumentResponseDto> {
    this.logger.log(`✏️ [PATCH /documents/${id}] Atualizando documento`);

    const dto = await parseAndValidatePayload(raw, UpdateDocumentDto);
    // O id da URL manda: o corpo repete o campo só por compatibilidade.
    dto.id = id;

    const file = findMediaFile(files, dto.media?.fileField);

    if (dto.media?.fileField && !file) {
      this.logger.warn(
        `⚠️ Nenhum arquivo encontrado com fieldname: ${dto.media.fileField}`,
      );
    }

    const result = await this.updateService.execute(id, dto, file);
    this.logger.log(`✅ Documento atualizado com sucesso: ID=${id}`);
    return result;
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    this.logger.log(`🗑️ [DELETE /documents/${id}] Removendo documento`);
    await this.deleteService.execute(id);
    this.logger.log(`✅ Documento removido com sucesso: ID=${id}`);
  }
}
