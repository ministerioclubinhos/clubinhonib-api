import {
  MediaItemEntity,
  MediaType,
  PlatformType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { DayEntity, WeekDay } from './entities/day.entity';
import { MeditationEntity } from './entities/meditation.entity';
import { sortDays, toMeditationResponse } from './mappers';

const day = (weekDay: WeekDay): DayEntity =>
  Object.assign(new DayEntity(), {
    id: `day-${weekDay}`,
    day: weekDay,
    verse: `Verso ${weekDay}`,
    topic: `Tema ${weekDay}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const meditation = (
  overrides: Partial<MeditationEntity> = {},
): MeditationEntity =>
  Object.assign(new MeditationEntity(), {
    id: 'meditation-id',
    topic: 'Semana da gratidão',
    startDate: '2026-08-31',
    endDate: '2026-09-04',
    days: [day(WeekDay.Monday), day(WeekDay.Friday)],
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-02T00:00:00.000Z'),
    ...overrides,
  });

const media = (): MediaItemEntity =>
  Object.assign(new MediaItemEntity(), {
    id: 'media-id',
    title: 'Material',
    description: 'PDF',
    mediaType: MediaType.DOCUMENT,
    uploadType: UploadType.LINK,
    platformType: PlatformType.GOOGLE_DRIVE,
    url: 'https://drive.google.com/file/d/1/view',
    isLocalFile: false,
    size: 0,
    originalName: '',
    targetId: 'meditation-id',
    targetType: 'Meditation',
  });

describe('meditation mappers', () => {
  describe('sortDays', () => {
    it('ordena de segunda a sexta, sem depender da ordem do banco', () => {
      const unordered = [
        day(WeekDay.Friday),
        day(WeekDay.Tuesday),
        day(WeekDay.Monday),
      ];

      expect(sortDays(unordered).map((item) => item.day)).toEqual([
        WeekDay.Monday,
        WeekDay.Tuesday,
        WeekDay.Friday,
      ]);
    });

    it('não altera o array recebido', () => {
      const unordered = [day(WeekDay.Friday), day(WeekDay.Monday)];
      sortDays(unordered);

      expect(unordered[0].day).toBe(WeekDay.Friday);
    });
  });

  describe('toMeditationResponse', () => {
    it('expõe as datas como YYYY-MM-DD', () => {
      const response = toMeditationResponse(meditation(), media());

      expect(response.startDate).toBe('2026-08-31');
      expect(response.endDate).toBe('2026-09-04');
    });

    it('usa uploadType, e não typeUpload, no contrato da mídia', () => {
      const response = toMeditationResponse(meditation(), media());

      expect(response.media?.uploadType).toBe(UploadType.LINK);
      expect(response.media).not.toHaveProperty('typeUpload');
    });

    it('devolve media nula quando a meditação não tem mídia', () => {
      const response = toMeditationResponse(meditation(), null);

      expect(response.media).toBeNull();
      expect(response.days).toHaveLength(2);
    });

    it('não quebra quando a relação de dias não foi carregada', () => {
      const response = toMeditationResponse(
        meditation({ days: undefined as never }),
        null,
      );

      expect(response.days).toEqual([]);
    });
  });
});
