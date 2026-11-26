import { AppValidationException } from 'src/shared/exceptions';
import { CreateMeditationDto } from './dto/create-meditation.dto';
import { WeekDay } from './entities/day.entity';
import {
  MediaType,
  PlatformType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import {
  assertMeditationPeriod,
  formatDateOnly,
  isWithinPeriod,
  parseAndValidatePayload,
  parseDateAsLocal,
  todayAsLocalDate,
} from './utils';

// 2026-08-31 é segunda; 2026-09-04 é sexta.
const MONDAY = '2026-08-31';
const FRIDAY = '2026-09-04';

const validPayload = (overrides: Record<string, unknown> = {}) => ({
  topic: 'Semana da gratidão',
  startDate: MONDAY,
  endDate: FRIDAY,
  media: {
    title: 'Material',
    description: 'PDF da meditação',
    mediaType: MediaType.DOCUMENT,
    uploadType: UploadType.LINK,
    isLocalFile: false,
    url: 'https://drive.google.com/file/d/1/view',
    platformType: PlatformType.GOOGLE_DRIVE,
  },
  days: [
    WeekDay.Monday,
    WeekDay.Tuesday,
    WeekDay.Wednesday,
    WeekDay.Thursday,
    WeekDay.Friday,
  ].map((day) => ({ day, verse: 'Sl 1', topic: 'Tema' })),
  ...overrides,
});

describe('meditation utils', () => {
  describe('parseDateAsLocal', () => {
    it('lê a data como local, sem deslocar o dia', () => {
      const date = parseDateAsLocal('2026-08-31');

      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(7);
      expect(date.getDate()).toBe(31);
    });

    it('aceita Date, porque o driver às vezes devolve Date em coluna date', () => {
      const date = parseDateAsLocal(new Date(2026, 7, 31, 23, 30));

      expect(formatDateOnly(date)).toBe('2026-08-31');
      expect(date.getHours()).toBe(0);
    });
  });

  describe('formatDateOnly', () => {
    it('preenche mês e dia com zero à esquerda', () => {
      expect(formatDateOnly(new Date(2026, 0, 5))).toBe('2026-01-05');
    });
  });

  describe('todayAsLocalDate', () => {
    it('zera o horário', () => {
      const today = todayAsLocalDate();

      expect(today.getHours()).toBe(0);
      expect(today.getMinutes()).toBe(0);
    });
  });

  describe('assertMeditationPeriod', () => {
    it('aceita de segunda a sexta', () => {
      expect(() =>
        assertMeditationPeriod({
          startDate: parseDateAsLocal(MONDAY),
          endDate: parseDateAsLocal(FRIDAY),
        }),
      ).not.toThrow();
    });

    it('recusa início fora de segunda-feira', () => {
      expect(() =>
        assertMeditationPeriod({
          startDate: parseDateAsLocal('2026-09-01'),
          endDate: parseDateAsLocal(FRIDAY),
        }),
      ).toThrow(AppValidationException);
    });

    it('recusa fim fora de sexta-feira', () => {
      expect(() =>
        assertMeditationPeriod({
          startDate: parseDateAsLocal(MONDAY),
          endDate: parseDateAsLocal('2026-09-03'),
        }),
      ).toThrow(AppValidationException);
    });

    it('recusa período invertido', () => {
      expect(() =>
        assertMeditationPeriod({
          startDate: parseDateAsLocal('2026-09-07'),
          endDate: parseDateAsLocal(FRIDAY),
        }),
      ).toThrow(AppValidationException);
    });
  });

  describe('isWithinPeriod', () => {
    const period = {
      startDate: parseDateAsLocal(MONDAY),
      endDate: parseDateAsLocal(FRIDAY),
    };

    it('inclui as pontas', () => {
      expect(isWithinPeriod(parseDateAsLocal(MONDAY), period)).toBe(true);
      expect(isWithinPeriod(parseDateAsLocal(FRIDAY), period)).toBe(true);
    });

    it('exclui datas fora do intervalo', () => {
      expect(isWithinPeriod(parseDateAsLocal('2026-09-05'), period)).toBe(
        false,
      );
    });
  });

  describe('parseAndValidatePayload', () => {
    it('devolve a instância validada', async () => {
      const dto = await parseAndValidatePayload(
        JSON.stringify(validPayload()),
        CreateMeditationDto,
      );

      expect(dto).toBeInstanceOf(CreateMeditationDto);
      expect(dto.days).toHaveLength(5);
    });

    it('recusa payload ausente', async () => {
      await expect(
        parseAndValidatePayload(undefined, CreateMeditationDto),
      ).rejects.toBeInstanceOf(AppValidationException);
    });

    it('recusa JSON malformado', async () => {
      await expect(
        parseAndValidatePayload('{quebrado', CreateMeditationDto),
      ).rejects.toBeInstanceOf(AppValidationException);
    });

    it('recusa semana incompleta', async () => {
      await expect(
        parseAndValidatePayload(
          JSON.stringify(
            validPayload({
              days: [{ day: WeekDay.Monday, verse: 'Sl 1', topic: 'Tema' }],
            }),
          ),
          CreateMeditationDto,
        ),
      ).rejects.toBeInstanceOf(AppValidationException);
    });

    it('recusa propriedade desconhecida', async () => {
      await expect(
        parseAndValidatePayload(
          JSON.stringify(validPayload({ inesperado: true })),
          CreateMeditationDto,
        ),
      ).rejects.toBeInstanceOf(AppValidationException);
    });
  });
});
