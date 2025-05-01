import {
  Inject,
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { RouteService } from 'src/route/route.service';
import { RouteType } from 'src/route/route-page.entity';
import { MediaType } from 'src/share/media/media-item/media-item.entity';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { MeditationRepository } from '../meditation.repository';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { CreateMeditationDto } from '../dto/create-meditation.dto';
import { MeditationEntity } from '../entities/meditation.entity';
import { MediaTargetType } from 'src/share/media/media-target-type.enum';

@Injectable()
export class CreateMeditationService {
  private readonly logger = new Logger(CreateMeditationService.name);

  constructor(
    @Inject(MeditationRepository)
    private readonly meditationRepo: MeditationRepository,
    private readonly s3Service: AwsS3Service,
    private readonly routeService: RouteService,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async create(
    dto: CreateMeditationDto,
    file?: Express.Multer.File,
  ): Promise<MeditationEntity> {
    try {
      this.logger.log('🟡 Criando nova meditação semanal');

      const startDate = parseDateAsLocal(dto.startDate);
      const endDate = parseDateAsLocal(dto.endDate);

      if (startDate.getDay() !== 1)
        throw new BadRequestException('startDate deve ser uma segunda-feira');
      if (endDate.getDay() !== 5)
        throw new BadRequestException('endDate deve ser uma sexta-feira');

      const existing = await this.meditationRepo.findAllWithRelations();
      const hasConflict = existing.some((m) => {
        const s = new Date(m.startDate);
        const e = new Date(m.endDate);
        return (
          (startDate >= s && startDate <= e) ||
          (endDate >= s && endDate <= e) ||
          (startDate <= s && endDate >= e)
        );
      });

      if (hasConflict) {
        throw new BadRequestException('Conflito com datas de uma meditação existente.');
      }

      const meditation = this.meditationRepo.create({
        topic: dto.topic,
        startDate: dto.startDate,
        endDate: dto.endDate,
        days: dto.days,
      });

      const savedMeditation = await this.meditationRepo.save(meditation);
      this.logger.log(`✅ Meditação salva: ID=${savedMeditation.id}`);

      let mediaUrl = dto.media.url?.trim() || '';
      let originalName = dto.media.originalName;
      let size = dto.media.size;

      if (dto.media.isLocalFile) {
        if (!file) throw new BadRequestException('Arquivo não enviado.');
        mediaUrl = await this.s3Service.upload(file);
        originalName = file.originalname;
        size = file.size;
        this.logger.log(`⬆️ Upload de mídia concluído: ${mediaUrl}`);
      }

      const mediaEntity = this.mediaItemProcessor.buildBaseMediaItem(
        {
          title: dto.media.title,
          description: dto.media.description,
          mediaType: MediaType.DOCUMENT,
          uploadType: dto.media.uploadType,
          platformType: dto.media.platformType ?? null,
          fileField: 'file',
          isLocalFile: dto.media.isLocalFile,
          url: mediaUrl,
          originalName,
          size,
        },
        savedMeditation.id,
        MediaTargetType.Meditation,
      );

      const savedMedia = await this.mediaItemProcessor.saveMediaItem(mediaEntity);
      this.logger.log(`🎞️ Mídia salva: ID=${savedMedia.id}`);

      const route = await this.routeService.createRoute({
        title: savedMeditation.topic,
        subtitle: '',
        idToFetch: savedMeditation.id,
        entityType:  MediaTargetType.Meditation,
        description: `Meditação semanal de ${dto.startDate} a ${dto.endDate}`,
        entityId: savedMeditation.id,
        type: RouteType.DOC,
        prefix: 'meditacao_',
        image: 'https://bucket-clubinho-galeria.s3.amazonaws.com/uploads/img_card.jpg',
        public: false,
      });

      this.logger.log(`🛤️ Rota criada com path: ${route.path}`);
      this.logger.log(`🎉 Meditação criada com sucesso`);

      return savedMeditation;
    } catch (error) {
      this.logger.error('❌ Erro ao criar meditação', error.stack);
      throw new BadRequestException(
        error?.message || 'Erro inesperado ao criar meditação.',
      );
    }
  }
}

function parseDateAsLocal(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}
