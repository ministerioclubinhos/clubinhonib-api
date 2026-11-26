import { toAddressSummary } from './address.utils';

describe('toAddressSummary', () => {
  it('copia os quatro campos quando há endereço', () => {
    expect(
      toAddressSummary({
        city: 'Campinas',
        state: 'SP',
        district: 'Centro',
        street: 'Rua A',
      }),
    ).toEqual({
      city: 'Campinas',
      state: 'SP',
      district: 'Centro',
      street: 'Rua A',
    });
  });

  it('devolve campos indefinidos para clubinho sem endereço (regressão do 500 em /statistics/clubs)', () => {
    expect(toAddressSummary(null)).toEqual({
      city: undefined,
      state: undefined,
      district: undefined,
      street: undefined,
    });
    expect(toAddressSummary(undefined)).toEqual({
      city: undefined,
      state: undefined,
      district: undefined,
      street: undefined,
    });
  });

  it('troca null por indefinido campo a campo', () => {
    expect(toAddressSummary({ city: 'Santos', state: null })).toEqual({
      city: 'Santos',
      state: undefined,
      district: undefined,
      street: undefined,
    });
  });
});
