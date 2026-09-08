import { Test } from '@nestjs/testing';

import { ClubControlRepository } from '../repositories/club-control.repository';
import { ClubPeriodEntity } from '../entities/club-period.entity';
import { AcademicWeekService } from './academic-week.service';

/** Período de 2026: começa numa segunda, termina num sábado — 42 semanas. */
const periodo = Object.assign(new ClubPeriodEntity(), {
  id: 'period-id',
  year: 2026,
  startDate: '2026-03-02',
  endDate: '2026-12-19',
  isActive: true,
});

describe('AcademicWeekService', () => {
  const clubControlRepository = { findPeriodByYear: jest.fn() };

  let service: AcademicWeekService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AcademicWeekService,
        { provide: ClubControlRepository, useValue: clubControlRepository },
      ],
    }).compile();

    service = moduleRef.get(AcademicWeekService);
  });

  describe('calculateMaxAcademicWeek', () => {
    it('conta as semanas do período sem inventar uma a mais', () => {
      // De 02/03 a 19/12/2026 são 42 semanas. A leitura antiga era em UTC: em
      // fuso negativo o início caía no domingo anterior, entrava na semana de
      // trás e o total saía 43. Como `checkClubWeek` recusa `week > max`, a
      // semana 43 passava e todo clubinho aparecia devendo pagela dela.
      expect(service.calculateMaxAcademicWeek(periodo)).toBe(42);
    });

    it('período de uma semana só conta 1', () => {
      const curto = Object.assign(new ClubPeriodEntity(), {
        year: 2026,
        startDate: '2026-03-02',
        endDate: '2026-03-08',
      });

      expect(service.calculateMaxAcademicWeek(curto)).toBe(1);
    });

    it('começar na segunda e terminar no domingo seguinte são 2 semanas', () => {
      const duas = Object.assign(new ClubPeriodEntity(), {
        year: 2026,
        startDate: '2026-03-02',
        endDate: '2026-03-15',
      });

      expect(service.calculateMaxAcademicWeek(duas)).toBe(2);
    });
  });

  describe('getExpectedDateForAcademicWeek', () => {
    it('devolve o dia da semana pedido, na semana pedida', () => {
      // Semana 1 começa na segunda 02/03; a quarta dessa semana é 04/03.
      expect(
        service.getExpectedDateForAcademicWeek(2026, 1, 'wednesday', periodo),
      ).toBe('2026-03-04');
    });

    it('avança sete dias por semana letiva', () => {
      expect(
        service.getExpectedDateForAcademicWeek(2026, 2, 'wednesday', periodo),
      ).toBe('2026-03-11');
      expect(
        service.getExpectedDateForAcademicWeek(2026, 3, 'monday', periodo),
      ).toBe('2026-03-16');
    });

    it('domingo cai no fim da semana, não no começo', () => {
      // A semana vai de segunda a domingo: o domingo da semana 1 é 08/03.
      expect(
        service.getExpectedDateForAcademicWeek(2026, 1, 'sunday', periodo),
      ).toBe('2026-03-08');
    });

    it('aceita o dia da semana em qualquer caixa', () => {
      expect(
        service.getExpectedDateForAcademicWeek(2026, 1, 'WEDNESDAY', periodo),
      ).toBe('2026-03-04');
    });

    it('recusa um dia da semana desconhecido', () => {
      expect(() =>
        service.getExpectedDateForAcademicWeek(2026, 1, 'quarta', periodo),
      ).toThrow('Invalid weekday: quarta');
    });
  });

  describe('isWeekWithinPeriod', () => {
    it('a primeira e a última semana estão dentro', () => {
      expect(service.isWeekWithinPeriod(2026, 1, periodo)).toBe(true);
      expect(service.isWeekWithinPeriod(2026, 42, periodo)).toBe(true);
    });

    it('uma semana além do fim está fora', () => {
      expect(service.isWeekWithinPeriod(2026, 43, periodo)).toBe(false);
    });

    it('sem período cadastrado, nada está dentro', () => {
      expect(service.isWeekWithinPeriod(2026, 1, null)).toBe(false);
    });
  });

  describe('calculateCurrentAcademicWeek', () => {
    it('sem período cadastrado devolve tudo nulo, sem quebrar', () => {
      clubControlRepository.findPeriodByYear.mockResolvedValue(null);

      return expect(service.calculateCurrentAcademicWeek()).resolves.toEqual({
        academicYear: null,
        academicWeek: null,
        isWithinPeriod: false,
        periodStartDate: null,
        periodEndDate: null,
      });
    });

    it('fora do período devolve semana 0 e marca que está fora', async () => {
      // Período de 2020: hoje está muito depois do fim.
      clubControlRepository.findPeriodByYear.mockResolvedValue(
        Object.assign(new ClubPeriodEntity(), {
          year: 2020,
          startDate: '2020-03-02',
          endDate: '2020-12-19',
        }),
      );

      const atual = await service.calculateCurrentAcademicWeek();

      expect(atual).toMatchObject({
        academicWeek: 0,
        isWithinPeriod: false,
        periodStartDate: '2020-03-02',
      });
    });
  });

  describe('hasPassedClubDay', () => {
    it('semana futura nunca passou', () => {
      expect(service.hasPassedClubDay('2099-01-01', false, true)).toBe(false);
    });

    it('semana passada já passou', () => {
      expect(service.hasPassedClubDay('2020-01-01', false, false)).toBe(true);
    });

    it('na semana corrente, compara com a data de hoje', () => {
      // Sem isso, um clubinho de sábado apareceria devendo pagela na segunda.
      expect(service.hasPassedClubDay('2099-01-01', true, false)).toBe(false);
      expect(service.hasPassedClubDay('2020-01-01', true, false)).toBe(true);
    });
  });

  describe('getWeekStartDate', () => {
    it('devolve a segunda-feira da semana', () => {
      // Quarta 04/03/2026 → segunda 02/03.
      expect(service.getWeekStartDate(new Date(2026, 2, 4)).getDate()).toBe(2);
    });

    it('domingo pertence à semana que começou na segunda anterior', () => {
      // Domingo 08/03/2026 → segunda 02/03, e não 09/03.
      expect(service.getWeekStartDate(new Date(2026, 2, 8)).getDate()).toBe(2);
    });
  });

  describe('isExpectedDateWithinPeriod', () => {
    /**
     * É o guarda que faz o controle de pagela concordar com o calendário.
     *
     * A agenda calcula os dias de clubinho cruzando o dia da semana com o
     * período letivo; o controle chega ao dia esperado por outra conta, a da
     * semana letiva. As duas só concordam porque esta verificação existe: sem
     * ela, um período que começa no meio da semana faria a semana 1 cobrar
     * pagela de um dia que o calendário não tem.
     */
    const periodoQueComecaNaQuarta = Object.assign(new ClubPeriodEntity(), {
      year: 2026,
      startDate: '2026-03-04',
      endDate: '2026-12-19',
      isActive: true,
    });

    it('recusa o dia do clubinho anterior à abertura do período', () => {
      // Clubinho de segunda, semana 1: 02/03 cai antes de o período abrir.
      expect(
        service.isExpectedDateWithinPeriod(
          '2026-03-02',
          periodoQueComecaNaQuarta,
        ),
      ).toBe(false);
    });

    it('aceita o dia do clubinho a partir da abertura', () => {
      expect(
        service.isExpectedDateWithinPeriod(
          '2026-03-05',
          periodoQueComecaNaQuarta,
        ),
      ).toBe(true);
    });

    it('recusa o dia posterior ao fim do período', () => {
      expect(service.isExpectedDateWithinPeriod('2026-12-21', periodo)).toBe(
        false,
      );
    });

    it('aceita os extremos do período', () => {
      expect(service.isExpectedDateWithinPeriod('2026-03-02', periodo)).toBe(
        true,
      );
      expect(service.isExpectedDateWithinPeriod('2026-12-19', periodo)).toBe(
        true,
      );
    });

    it('sem período cadastrado, nenhum dia é esperado', () => {
      expect(service.isExpectedDateWithinPeriod('2026-03-02', null)).toBe(
        false,
      );
    });
  });
});
