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

  describe('calculateCurrentAcademicWeek — período que contém hoje', () => {
    const periodoPorAno = (periodos: ClubPeriodEntity[]) => (ano: number) =>
      Promise.resolve(periodos.find((p) => p.year === ano) ?? null);

    afterEach(() => {
      jest.useRealTimers();
    });

    it('acha a semana letiva dentro do período do ano corrente', async () => {
      // Quarta 11/11/2026, meio-dia em Brasília. O período começou em 02/03:
      // 11/11 cai na semana 37.
      jest.useFakeTimers().setSystemTime(new Date('2026-11-11T15:00:00Z'));
      clubControlRepository.findPeriodByYear.mockImplementation(
        periodoPorAno([periodo]),
      );

      await expect(service.calculateCurrentAcademicWeek()).resolves.toEqual({
        academicYear: 2026,
        academicWeek: 37,
        isWithinPeriod: true,
        periodStartDate: '2026-03-02',
        periodEndDate: '2026-12-19',
      });
    });

    it('período que atravessa a virada do ano continua valendo em janeiro', async () => {
      // O período de 2026 vai até 30/01/2027. Em 15/01/2027 a busca só por
      // `year = 2027` não achava nada e dizia "fora do período" em plena aula.
      const atravessaOAno = Object.assign(new ClubPeriodEntity(), {
        year: 2026,
        startDate: '2026-03-02',
        endDate: '2027-01-30',
        isActive: true,
      });
      jest.useFakeTimers().setSystemTime(new Date('2027-01-15T15:00:00Z'));
      clubControlRepository.findPeriodByYear.mockImplementation(
        periodoPorAno([atravessaOAno]),
      );

      const atual = await service.calculateCurrentAcademicWeek();

      expect(atual).toMatchObject({
        academicYear: 2026,
        isWithinPeriod: true,
        periodEndDate: '2027-01-30',
      });
      expect(atual?.academicWeek).toBe(46);
    });

    it('o dia vem do fuso do Clubinho, não do relógio em UTC', async () => {
      // 02:00 UTC do dia 20/12 ainda é 23:00 de 19/12 em Brasília — o último
      // dia do período. Com `toISOString()` o serviço já via o dia 20 e
      // declarava o período encerrado três horas antes da hora.
      jest.useFakeTimers().setSystemTime(new Date('2026-12-20T02:00:00Z'));
      clubControlRepository.findPeriodByYear.mockImplementation(
        periodoPorAno([periodo]),
      );

      await expect(
        service.calculateCurrentAcademicWeek(),
      ).resolves.toMatchObject({ isWithinPeriod: true, academicWeek: 42 });
    });

    it('entre dois períodos, informa o do ano corrente e marca que está fora', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-10T15:00:00Z'));
      clubControlRepository.findPeriodByYear.mockImplementation(
        periodoPorAno([periodo]),
      );

      await expect(
        service.calculateCurrentAcademicWeek(),
      ).resolves.toMatchObject({
        academicYear: 2026,
        academicWeek: 0,
        isWithinPeriod: false,
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

    it('às 22h de Brasília o clubinho de hoje ainda não passou', () => {
      // 01:00 UTC de 12/11 é 22:00 de 11/11 no Brasil.
      jest.useFakeTimers().setSystemTime(new Date('2026-11-12T01:00:00Z'));

      expect(service.hasPassedClubDay('2026-11-11', true, false)).toBe(false);
      expect(service.hasPassedClubDay('2026-11-10', true, false)).toBe(true);

      jest.useRealTimers();
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
