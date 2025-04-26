import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  BadRequestException,
  UseInterceptors,
  UploadedFiles,
  Logger,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';

import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

import { CreateDocumentService } from './services/create-document.service';
import { UpdateDocumentService } from './services/update-document.service';
import { GetDocumentService } from './services/get-document.service';
import { DeleteDocumentService } from './services/delete-document.service';

@Controller('documents')
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(
    private readonly createService: CreateDocumentService,
    private readonly updateService: UpdateDocumentService,
    private readonly getService: GetDocumentService,
    private readonly deleteService: DeleteDocumentService,
  ) {}

  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('documentData') documentDataRaw?: string,
  ) {
    this.logger.log('📥 [POST /documents] Criando novo documento');

    if (!documentDataRaw) {
      throw new BadRequestException('Campo "documentData" não enviado.');
    }

    let dto: CreateDocumentDto;
    try {
      const parsed = JSON.parse(documentDataRaw);
      dto = plainToInstance(CreateDocumentDto, parsed);
      await validateOrReject(dto);
    } catch {
      throw new BadRequestException('Erro ao processar dados do documento.');
    }

    const file = dto.media?.fileField
      ? files?.find((f) => f.fieldname === dto.media.fileField)
      : undefined;

    if (dto.media?.fileField && !file) {
      this.logger.warn(`⚠️ Nenhum arquivo encontrado com fieldname: ${dto.media.fileField}`);
    }

    const result = await this.createService.execute(dto, file);
    this.logger.log('✅ Documento criado com sucesso');
    return result;
  }

  @Get()
  findAll() {
    this.logger.log('📄 [GET /documents] Listando todos os documentos');
    return this.getService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    this.logger.log(`🔍 [GET /documents/${id}] Buscando documento`);
    return this.getService.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('documentData') documentDataRaw?: string,
  ) {
    this.logger.log(`✏️ [PATCH /documents/${id}] Atualizando documento`);

    if (!documentDataRaw) {
      throw new BadRequestException('Campo "documentData" não enviado.');
    }

    let dto: UpdateDocumentDto;
    try {
      const parsed = JSON.parse(documentDataRaw);
      dto = plainToInstance(UpdateDocumentDto, parsed);
      dto.id = id;
      await validateOrReject(dto);
    } catch {
      throw new BadRequestException('Erro ao processar dados do documento.');
    }

    const file = dto.media?.fileField
      ? files?.find((f) => f.fieldname === dto.media.fileField)
      : undefined;

    if (dto.media?.fileField && !file) {
      this.logger.warn(`⚠️ Nenhum arquivo encontrado com fieldname: ${dto.media.fileField}`);
    }

    const result = await this.updateService.execute(id, dto, file);
    this.logger.log(`✅ Documento atualizado com sucesso: ID=${id}`);
    return result;
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    this.logger.log(`🗑️ [DELETE /documents/${id}] Removendo documento`);
    return this.deleteService.execute(id);
  }
}
