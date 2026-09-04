import { toDateOnly, toIsoDateTime } from './utils';

/**
 * As colunas de nascimento e entrada são de data pura e voltam ora como `Date`,
 * ora como texto, conforme o driver. Antes cada serviço tinha a sua cópia desta
 * conversão.
 */
describe('toDateOnly', () => {
  it('mantém o dia de calendário de um texto já no formato', () => {
    expect(toDateOnly('2026-05-20')).toBe('2026-05-20');
  });

  it('corta o horário de um carimbo completo', () => {
    expect(toDateOnly('2026-05-20T23:30:00.000Z')).toBe('2026-05-20');
  });

  it('converte um Date', () => {
    expect(toDateOnly(new Date('1990-05-20T00:00:00Z'))).toBe('1990-05-20');
  });

  it('devolve nulo para ausente, vazio ou inválido', () => {
    expect(toDateOnly(null)).toBeNull();
    expect(toDateOnly(undefined)).toBeNull();
    expect(toDateOnly('nao-e-data')).toBeNull();
    expect(toDateOnly(new Date('invalida'))).toBeNull();
  });
});

describe('toIsoDateTime', () => {
  it('preserva um carimbo que já está em ISO', () => {
    expect(toIsoDateTime('2026-05-20T12:00:00.000Z')).toBe(
      '2026-05-20T12:00:00.000Z',
    );
  });

  it('converte um Date', () => {
    expect(toIsoDateTime(new Date('2026-05-20T12:00:00Z'))).toBe(
      '2026-05-20T12:00:00.000Z',
    );
  });
});
