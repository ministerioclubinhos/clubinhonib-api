import {
    Controller,
    Post,
    Get,
    Patch,
    Delete,
    Param,
    Body,
    NotFoundException,
    Logger,
  } from '@nestjs/common';
  import { CreateInformativeDto } from './dto/create-informative.dto';
  import { UpdateInformativeDto } from './dto/update-informative.dto';
  import { InformativeResponseDto } from './dto/informative-response.dto';
  import { CreateInformativeService } from './services/create-informative.service';
  import { GetInformativeService } from './services/get-informative.service';
  import { UpdateInformativeService } from './services/update-informative.service';
  import { DeleteInformativeService } from './services/delete-informative.service';
  
  @Controller('informatives')
  export class InformativeController {
    private readonly logger = new Logger(InformativeController.name);
  
    constructor(
      private readonly createService: CreateInformativeService,
      private readonly getService: GetInformativeService,
      private readonly updateService: UpdateInformativeService,
      private readonly deleteService: DeleteInformativeService,
    ) {}
  
    @Post()
    async create(@Body() dto: CreateInformativeDto): Promise<InformativeResponseDto> {
      this.logger.log('POST /informatives - Criando banner informativo');
      return this.createService.createInformative(dto);
    }
  
    @Get(':id')
    async findOne(@Param('id') id: string): Promise<InformativeResponseDto> {
      this.logger.log(`GET /informatives/${id} - Buscando banner`);
      const found = await this.getService.findOne(id);
      if (!found) {
        this.logger.warn(`GET /informatives/${id} - Não encontrado`);
        throw new NotFoundException('Banner informativo não encontrado');
      }
      return found;
    }
  
    @Patch(':id')
    async update(
      @Param('id') id: string,
      @Body() dto: UpdateInformativeDto,
    ): Promise<InformativeResponseDto> {
      this.logger.log(`PATCH /informatives/${id} - Atualizando banner`);
      return this.updateService.execute(id, dto);
    }
  
    @Delete(':id')
    async delete(@Param('id') id: string): Promise<void> {
      this.logger.log(`DELETE /informatives/${id} - Removendo banner`);
      return this.deleteService.execute(id);
    }
  
    @Get()
    async findAll(): Promise<InformativeResponseDto[]> {
      this.logger.log('GET /informatives - Listando todos os banners');
      return this.getService.findAll();
    }
  }
  