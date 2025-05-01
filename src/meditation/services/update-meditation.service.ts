import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { MeditationRepository } from '../meditation.repository';
import { UpdateMeditationDto } from '../dto/update-meditation.dto';
import { MeditationEntity } from '../entities/meditation.entity';
import { DayEntity } from '../entities/day.entity';
import { MediaTargetType } from 'src/share/media/media-target-type.enum';

@Injectable()
export class UpdateMeditationService {
  private readonly logger = new Logger(UpdateMeditationService.name);

  constructor(
    private readonly meditationRepo: MeditationRepository,
    private readonly dataSource: DataSource,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly s3Service: AwsS3Service,
  ) {}

  async update(
    id: string,
    dto: UpdateMeditationDto & { isLocalFile?: boolean },
    file?: Express.Multer.File,
  ): Promise<MeditationEntity> {
    this.logger.log(`🛠️ Atualizando meditação ID=${id}`);

    const existing = await this.meditationRepo.findOneWithRelations(id);
    if (!existing) throw new NotFoundException('Meditação não encontrada');

    const startDate = dto.startDate ? parseDateAsLocal(dto.startDate) : existing.startDate;
    const endDate = dto.endDate ? parseDateAsLocal(dto.endDate) : existing.endDate;

    if (dto.startDate && startDate.getDay() !== 1) {
      throw new BadRequestException('startDate deve ser uma segunda-feira (Monday)');
    }

    if (dto.endDate && endDate.getDay() !== 5) {
      throw new BadRequestException('endDate deve ser uma sexta-feira (Friday)');
    }

    const all = await this.meditationRepo.findAllWithRelations();
    const hasConflict = all.some((m) => {
      if (m.id === id) return false;
      const s = new Date(m.startDate);
      const e = new Date(m.endDate);
      return (
        (startDate >= s && startDate <= e) ||
        (endDate >= s && endDate <= e) ||
        (startDate <= s && endDate >= e)
      );
    });

    if (hasConflict) {
      throw new BadRequestException('Conflito com outra meditação existente.');
    }

    return await this.dataSource.transaction(async (manager) => {
      const updatedMeditation = manager.merge(MeditationEntity, existing, {
        ...dto,
        startDate,
        endDate,
      });

      const savedMeditation = await manager.save(MeditationEntity, updatedMeditation);
      this.logger.log(`✅ Meditação atualizada: ${savedMeditation.id}`);

      if (dto.days) {
        await manager.remove(DayEntity, existing.days);
        const newDays = dto.days.map((day) =>
          manager.create(DayEntity, { ...day, meditation: savedMeditation }),
        );
        await manager.save(DayEntity, newDays);
      }

      if (dto.media) {
        const mediaItemsInput = [
          {
            id: dto.media.id,
            title: dto.media.title ?? savedMeditation.topic,
            description:
              dto.media.description ?? `Material da meditação: ${savedMeditation.topic}`,
            mediaType: dto.media.mediaType,
            uploadType: dto.media.uploadType,
            platformType: dto.media.isLocalFile ? null : dto.media.platformType,
            url: dto.media.url,
            originalName: dto.media.originalName,
            size: dto.media.size,
            isLocalFile: dto.media.isLocalFile,
            fileField: dto.media.fieldKey ?? 'file',
            public: false
          },
        ];

        const filesDict = file ? { [dto.media.fieldKey ?? 'file']: file } : {};
        const existingMedia = await this.mediaItemProcessor.findMediaItemsByTarget(
          savedMeditation.id,
          MediaTargetType.Meditation,
        );

        const [mediaEntity] = await this.mediaItemProcessor.cleanAndReplaceMediaItems(
          mediaItemsInput,
          savedMeditation.id,
          MediaTargetType.Meditation,
          filesDict,
          existingMedia,
          (url) => this.s3Service.delete(url),
          (file) => this.s3Service.upload(file),
        );

        this.logger.log(`📎 Mídia atualizada: ${mediaEntity.title}`);
      }

      return savedMeditation;
    });
  }
}

function parseDateAsLocal(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}
