import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  AppNotFoundException,
  AppInternalException,
  ErrorCode,
} from 'src/shared/exceptions';
import { InformativeRepository } from '../informative.repository';
import { InformativeResponseDto } from '../dto/informative-response.dto';

@Injectable()
export class GetInformativeService {
  private readonly logger = new Logger(GetInformativeService.name);

  constructor(
    @Inject(InformativeRepository)
    private readonly informativeRepo: InformativeRepository,
  ) {}

  async findAll(): Promise<InformativeResponseDto[]> {
    this.logger.log('📢 Buscando todos os banners informativos');
    try {
      const list = await this.informativeRepo.findAllSorted();
      return list.map((entity) => InformativeResponseDto.fromEntity(entity));
    } catch (error) {
      this.logger.error('❌ Erro ao buscar banners', error.stack);
      throw new AppInternalException(ErrorCode.DATABASE_ERROR, 'Erro ao buscar banners informativos');
    }
  }

  async findOne(id: string): Promise<InformativeResponseDto> {
    this.logger.log(`🔍 Buscando banner por ID=${id}`);
    const item = await this.informativeRepo.findOneById(id);
    if (!item) {
      this.logger.warn(`⚠️ Banner não encontrado: ID=${id}`);
      throw new AppNotFoundException(ErrorCode.INFORMATIVE_NOT_FOUND, 'Banner informativo não encontrado');
    }

    return InformativeResponseDto.fromEntity(item);
  }
}
