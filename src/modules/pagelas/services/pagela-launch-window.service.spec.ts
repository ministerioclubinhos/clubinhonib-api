import { AppBusinessException, ErrorCode } from 'src/shared/exceptions';
import { ClubControlService } from 'src/modules/club-control/services/club-control.service';
import { todayInAppTimezone } from 'src/shared/calendar-day/calendar-day.util';

import { PagelaLaunchClosedReason } from '../enums/pagela-launch-closed-reason.enum';
import { launchClosedMessage, launchWindowOf } from '../launch-window.utils';
import { PagelaLaunchWindowService } from './pagela-launch-window.service';

jest.mock('src/shared/calendar-day/calendar-day.util', () => ({
  todayInAppTimezone: jest.fn(),
}));

// Segunda-feira, 2 de março de 2026, a quinta, 10 de dezembro.
const PERIOD_2026 = {
  year: 2026,
  startDate: '2026-03-02',
  endDate: '2026-12-10',
};

describe('janela de lançamento de pagelas', () => {
  describe('launchWindowOf', () => {
    it('abre dentro do período e informa a semana letiva de hoje', () => {
      const window = launchWindowOf('2026-03-18', [PERIOD_2026]);

      expect(window).toMatchObject({
        open: true,
        reason: null,
        year: 2026,
        currentWeek: 3,
        totalWeeks: 41,
      });
    });

    it('abre no primeiro e no último dia do período', () => {
      expect(launchWindowOf('2026-03-02', [PERIOD_2026]).open).toBe(true);
      expect(launchWindowOf('2026-12-10', [PERIOD_2026]).open).toBe(true);
    });

    it('fecha depois do fim, dizendo que o período terminou', () => {
      const window = launchWindowOf('2026-12-11', [PERIOD_2026]);

      expect(window).toMatchObject({
        open: false,
        reason: PagelaLaunchClosedReason.ENDED,
        currentWeek: null,
      });
      expect(launchClosedMessage(window)).toContain('10/12/2026');
    });

    it('fecha antes do início, dizendo quando começa', () => {
      const window = launchWindowOf('2026-03-01', [PERIOD_2026]);

      expect(window.reason).toBe(PagelaLaunchClosedReason.NOT_STARTED);
      expect(launchClosedMessage(window)).toContain('02/03/2026');
    });

    it('entre dois períodos, aponta para o próximo', () => {
      const next = {
        year: 2027,
        startDate: '2027-03-01',
        endDate: '2027-12-09',
      };
      const window = launchWindowOf('2027-01-15', [PERIOD_2026, next]);

      expect(window).toMatchObject({
        reason: PagelaLaunchClosedReason.NOT_STARTED,
        startDate: '2027-03-01',
      });
    });

    it('sem período algum, diz que falta cadastrar', () => {
      const window = launchWindowOf('2026-05-05', []);

      expect(window.reason).toBe(PagelaLaunchClosedReason.NO_PERIOD);
      expect(launchClosedMessage(window)).toContain('período letivo');
    });
  });

  describe('PagelaLaunchWindowService', () => {
    let service: PagelaLaunchWindowService;
    let getPeriodByYear: jest.Mock;

    const todayIs = (day: string) =>
      (todayInAppTimezone as jest.Mock).mockReturnValue(day);

    beforeEach(() => {
      getPeriodByYear = jest.fn((year: number) =>
        Promise.resolve(year === 2026 ? PERIOD_2026 : null),
      );
      service = new PagelaLaunchWindowService({
        getPeriodByYear,
      } as unknown as ClubControlService);
      todayIs('2026-03-18');
    });

    const refusalOf = async (attempt: Promise<unknown>) => {
      const error = await attempt.catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(AppBusinessException);
      return error as AppBusinessException;
    };

    describe('criação', () => {
      it('recusa quando hoje está fora do período, mesmo com ano e semana no corpo', async () => {
        todayIs('2026-12-20');

        const error = await refusalOf(
          service.resolveForCreation({
            referenceDate: '2026-12-09',
            year: 2026,
            week: 41,
          }),
        );

        expect(error.code).toBe(ErrorCode.ACADEMIC_PERIOD_CLOSED);
      });

      it('recusa quando não há período letivo cadastrado', async () => {
        getPeriodByYear.mockResolvedValue(null);

        const error = await refusalOf(
          service.resolveForCreation({ referenceDate: '2026-03-18' }),
        );

        expect(error.code).toBe(ErrorCode.ACADEMIC_PERIOD_CLOSED);
      });

      it('deriva a semana letiva da data quando ela não vem', async () => {
        await expect(
          service.resolveForCreation({ referenceDate: '2026-03-11' }),
        ).resolves.toEqual({ year: 2026, week: 2 });
      });

      it('aceita uma semana que já aconteceu, lançada hoje', async () => {
        await expect(
          service.resolveForCreation({
            referenceDate: '2026-03-18',
            year: 2026,
            week: 1,
          }),
        ).resolves.toEqual({ year: 2026, week: 1 });
      });

      it('recusa semana futura', async () => {
        const error = await refusalOf(
          service.resolveForCreation({
            referenceDate: '2026-03-18',
            year: 2026,
            week: 4,
          }),
        );

        expect(error.code).toBe(ErrorCode.INVALID_DATE_RANGE);
        expect(error.message).toContain('3');
      });

      it('recusa a semana do calendário mandada no lugar da semana letiva', async () => {
        // 18/03/2026 é a semana ISO 12, mas a semana letiva 3.
        await refusalOf(
          service.resolveForCreation({
            referenceDate: '2026-03-18',
            year: 2026,
            week: 12,
          }),
        );
      });

      it('recusa ano que não é o do período em andamento', async () => {
        await refusalOf(
          service.resolveForCreation({
            referenceDate: '2026-03-18',
            year: 2025,
            week: 2,
          }),
        );
      });

      it('recusa data futura e data anterior ao período', async () => {
        await refusalOf(
          service.resolveForCreation({ referenceDate: '2026-03-19' }),
        );
        await refusalOf(
          service.resolveForCreation({ referenceDate: '2026-02-20' }),
        );
      });
    });

    describe('edição', () => {
      const stored = { year: 2026, week: 2, referenceDate: '2026-03-11' };

      it('recusa qualquer edição fora do período letivo', async () => {
        todayIs('2027-01-10');

        const error = await refusalOf(service.resolveForUpdate({}, stored));

        expect(error.code).toBe(ErrorCode.ACADEMIC_PERIOD_CLOSED);
      });

      it('não reavalia a semana quando a edição não a muda', async () => {
        await expect(
          service.resolveForUpdate(
            { year: 2026, week: 2, referenceDate: '2026-03-11' },
            stored,
          ),
        ).resolves.toBeNull();
      });

      it('deixa corrigir pagela de ano anterior sem recusar a semana antiga', async () => {
        await expect(
          service.resolveForUpdate(
            { year: 2025, week: 40 },
            { year: 2025, week: 40, referenceDate: '2025-11-20' },
          ),
        ).resolves.toBeNull();
      });

      it('recalcula a semana quando só a data muda', async () => {
        await expect(
          service.resolveForUpdate({ referenceDate: '2026-03-03' }, stored),
        ).resolves.toEqual({ year: 2026, week: 1 });
      });

      it('recusa mover a pagela para semana futura ou data fora do período', async () => {
        await refusalOf(service.resolveForUpdate({ week: 9 }, stored));
        await refusalOf(
          service.resolveForUpdate({ referenceDate: '2026-02-01' }, stored),
        );
      });
    });
  });
});
