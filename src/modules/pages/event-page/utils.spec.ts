import {
  AppBusinessException,
  AppValidationException,
  ErrorCode,
} from 'src/shared/exceptions';
import { CreateEventDto } from './dto/create-event.dto';
import { Weekday } from 'src/modules/clubs/entities/weekday.enum';
import {
  assertNotClubMeeting,
  formatClubLocation,
  nextOccurrence,
  parseAndValidatePayload,
  toEventDay,
  todayAtMidnight,
} from './utils';

const validPayload = JSON.stringify({
  title: 'Festa da Família',
  date: '2026-04-12',
  location: 'Salão',
  description: 'Traga a família.',
});

describe('utils do evento', () => {
  describe('parseAndValidatePayload', () => {
    it('devolve o DTO validado', async () => {
      const dto = await parseAndValidatePayload(validPayload, CreateEventDto);

      expect(dto).toBeInstanceOf(CreateEventDto);
      expect(dto.title).toBe('Festa da Família');
    });

    it('recusa payload ausente', async () => {
      await expect(
        parseAndValidatePayload(undefined, CreateEventDto),
      ).rejects.toBeInstanceOf(AppValidationException);
    });

    it('recusa JSON inválido', async () => {
      await expect(
        parseAndValidatePayload('{', CreateEventDto),
      ).rejects.toBeInstanceOf(AppValidationException);
    });

    it('recusa campo desconhecido', async () => {
      await expect(
        parseAndValidatePayload(
          JSON.stringify({
            title: 'X',
            date: '2026-04-12',
            location: 'Y',
            description: 'Z',
            inesperado: true,
          }),
          CreateEventDto,
        ),
      ).rejects.toBeInstanceOf(AppValidationException);
    });

    it('leva a mensagem da validação para quem chamou', async () => {
      await expect(
        parseAndValidatePayload(
          JSON.stringify({ title: 1, date: 'x', location: 2, description: 3 }),
          CreateEventDto,
        ),
      ).rejects.toThrow(/deve ser uma string|formato ISO/);
    });
  });

  describe('toEventDay', () => {
    it('lê a data pelos componentes, sem passar por UTC', () => {
      // `new Date('2026-04-12')` seria meia-noite UTC e viraria dia 11 aqui.
      const day = toEventDay('2026-04-12');

      expect(day.getFullYear()).toBe(2026);
      expect(day.getMonth()).toBe(3);
      expect(day.getDate()).toBe(12);
    });

    it('ignora a hora de uma data ISO completa', () => {
      expect(toEventDay('2026-04-12T23:30:00.000Z').getDate()).toBe(12);
    });
  });

  describe('nextOccurrence', () => {
    it('devolve hoje quando já é o dia da semana do clubinho', () => {
      // 2026-04-15 é uma quarta-feira.
      expect(nextOccurrence(Weekday.WEDNESDAY, new Date(2026, 3, 15))).toBe(
        '2026-04-15',
      );
    });

    it('devolve o próximo dia da semana correspondente', () => {
      expect(nextOccurrence(Weekday.FRIDAY, new Date(2026, 3, 15))).toBe(
        '2026-04-17',
      );
      expect(nextOccurrence(Weekday.TUESDAY, new Date(2026, 3, 15))).toBe(
        '2026-04-21',
      );
    });

    it('vira o mês e o ano quando precisa', () => {
      expect(nextOccurrence(Weekday.FRIDAY, new Date(2026, 11, 30))).toBe(
        '2027-01-01',
      );
    });
  });

  describe('formatClubLocation', () => {
    it('junta rua, número, bairro e cidade', () => {
      expect(
        formatClubLocation({
          street: 'Rua das Flores',
          number: '100',
          district: 'Centro',
          city: 'São Paulo',
          state: 'SP',
        }),
      ).toBe('Rua das Flores, 100 · Centro · São Paulo - SP');
    });

    it('ignora as partes que faltam', () => {
      expect(formatClubLocation({ street: 'Rua A', city: 'Campinas' })).toBe(
        'Rua A · Campinas',
      );
    });

    it('usa o texto de reserva sem endereço', () => {
      expect(formatClubLocation(null)).toBe('Endereço não informado');
      expect(formatClubLocation({})).toBe('Endereço não informado');
    });
  });

  describe('todayAtMidnight', () => {
    it('zera a hora', () => {
      const today = todayAtMidnight();

      expect(today.getHours()).toBe(0);
      expect(today.getMinutes()).toBe(0);
      expect(today.getSeconds()).toBe(0);
    });
  });

  describe('assertNotClubMeeting', () => {
    it('deixa passar um evento comum da agenda', () => {
      expect(() => assertNotClubMeeting({ clubId: null })).not.toThrow();
      expect(() => assertNotClubMeeting({})).not.toThrow();
    });

    it('recusa mexer no encontro semanal de um clubinho', () => {
      // Alterar por aqui seria desfeito na próxima sincronização, e excluir
      // deixaria o clubinho sem encontro — antes desta trava, ainda disparava
      // um e-mail de "evento cancelado" para toda a base.
      expect(() => assertNotClubMeeting({ clubId: 'club-1' })).toThrow(
        AppBusinessException,
      );
    });

    it('devolve um código próprio, para a tela explicar o motivo', () => {
      try {
        assertNotClubMeeting({ clubId: 'club-1' });
        throw new Error('deveria ter lançado');
      } catch (error) {
        expect((error as AppBusinessException).code).toBe(
          ErrorCode.CLUB_MEETING_NOT_EDITABLE,
        );
      }
    });
  });
});
