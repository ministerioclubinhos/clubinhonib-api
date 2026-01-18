import { Injectable, NotFoundException, Logger, InternalServerErrorException } from '@nestjs/common';
import { SiteFeedbackEntity } from './entity/site-feedback.entity';
import { SiteFeedbackRepository } from './repository/site-feedback.repository';
import { CreateSiteFeedbackDto } from './dto/create-site-feedback.dto';
import { UpdateSiteFeedbackDto } from './dto/update-site-feedback.dto';

@Injectable()
export class SiteFeedbackService {
  private readonly logger = new Logger(SiteFeedbackService.name);

  constructor(private readonly siteFeedbackRepo: SiteFeedbackRepository) { }

  async create(dto: CreateSiteFeedbackDto): Promise<SiteFeedbackEntity> {
    this.logger.debug(`📝 Criando novo feedback do site`);
    const feedback = this.siteFeedbackRepo.create(dto);
    const saved = await this.siteFeedbackRepo.save(feedback);
    this.logger.log(`✅ Feedback do site salvo com ID: ${saved.id}`);
    return saved;
  }

  async findAll(): Promise<SiteFeedbackEntity[]> {
    this.logger.debug('📄 Buscando todos os feedbacks do site');
    const feedbacks = await this.siteFeedbackRepo.findAll();
    this.logger.log(`✅ Total de feedbacks do site encontrados: ${feedbacks.length}`);
    return feedbacks;
  }

  async findOne(id: string): Promise<SiteFeedbackEntity> {
    this.logger.debug(`🔍 Buscando feedback do site por ID: ${id}`);
    const feedback = await this.siteFeedbackRepo.findOneBy({ id });
    if (!feedback) {
      this.logger.warn(`⚠️ Feedback do site não encontrado: ID=${id}`);
      throw new NotFoundException('Feedback do site não encontrado');
    }
    this.logger.log(`✅ Feedback do site encontrado: ID=${feedback.id}`);
    return feedback;
  }

  async update(id: string, dto: UpdateSiteFeedbackDto): Promise<SiteFeedbackEntity> {
    this.logger.debug(`✏️ Atualizando feedback do site ID=${id}`);
    const feedback = await this.findOne(id);
    Object.assign(feedback, dto);
    const updated = await this.siteFeedbackRepo.save(feedback);
    this.logger.log(`✅ Feedback do site atualizado: ID=${updated.id}`);
    return updated;
  }

  async remove(id: string): Promise<void> {
    this.logger.debug(`🗑️ Removendo feedback do site ID=${id}`);
    const feedback = await this.findOne(id);
    await this.siteFeedbackRepo.remove(feedback);
    this.logger.log(`✅ Feedback do site removido: ID=${id}`);
  }

  async setReadOnFeedback(id: string): Promise<SiteFeedbackEntity> {
    try {
      this.logger.log('📥 Buscando feedback do site...');
      const feedback = await this.siteFeedbackRepo.findById(id);

      if (!feedback) {
        this.logger.warn(`⚠️ Feedback do site não encontrado com id: ${id}`);
        throw new NotFoundException('Feedback do site não encontrado');
      }

      feedback.read = true;

      this.logger.log(`📥 Atualizando feedback do site...`);
      const updatedFeedback = await this.siteFeedbackRepo.save(feedback);

      return updatedFeedback;
    } catch (error) {
      this.logger.error('❌ Erro ao buscar ou atualizar feedback do site', error.stack);
      throw new InternalServerErrorException('Erro ao buscar ou atualizar feedback do site');
    }
  }
}
