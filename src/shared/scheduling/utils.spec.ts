import { SCHEDULING_ENABLED_ENV } from './constants';
import { errorMessage, formatDuration, isSchedulerEnabled } from './utils';

const reader =
  (value: string | undefined) =>
  (key: string): string | undefined =>
    key === SCHEDULING_ENABLED_ENV ? value : undefined;

describe('isSchedulerEnabled', () => {
  it.each(['true', 'TRUE', ' True ', '1'])('liga com %p', (value) => {
    expect(isSchedulerEnabled(reader(value))).toBe(true);
  });

  /**
   * Qualquer coisa fora da lista mantém desligado. Um aviso que não sai custa
   * um clique; um aviso duplicado sai para toda a base.
   */
  it.each(['false', '0', 'sim', 'yes', '', ' ', undefined])(
    'mantém desligado com %p',
    (value) => {
      expect(isSchedulerEnabled(reader(value))).toBe(false);
    },
  );
});

describe('formatDuration', () => {
  it('mostra milissegundos abaixo de um segundo', () => {
    expect(formatDuration(0)).toBe('0ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  it('mostra segundos com uma casa a partir de um segundo', () => {
    expect(formatDuration(1000)).toBe('1.0s');
    expect(formatDuration(90_500)).toBe('90.5s');
  });
});

describe('errorMessage', () => {
  it('usa a mensagem de um Error', () => {
    expect(errorMessage(new Error('SMTP fora do ar'))).toBe('SMTP fora do ar');
  });

  it('converte o que não é Error', () => {
    expect(errorMessage('caiu')).toBe('caiu');
    expect(errorMessage(undefined)).toBe('undefined');
  });
});
