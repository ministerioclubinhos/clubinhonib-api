import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { UnsubscribeTokenService } from './unsubscribe-token.service';

describe('UnsubscribeTokenService', () => {
  const config: Record<string, string | undefined> = {
    EMAIL_UNSUBSCRIBE_SECRET: 'segredo-de-teste',
  };
  const configService = { get: (key: string) => config[key] };

  const build = async (): Promise<UnsubscribeTokenService> => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        UnsubscribeTokenService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    return moduleRef.get(UnsubscribeTokenService);
  };

  beforeEach(() => {
    config.EMAIL_UNSUBSCRIBE_SECRET = 'segredo-de-teste';
    config.JWT_SECRET = undefined;
  });

  it('reconhece o token que ele mesmo emitiu', async () => {
    const service = await build();
    const token = service.create('user-1');

    expect(service.verify(token)).toBe('user-1');
  });

  it('emite tokens diferentes para pessoas diferentes', async () => {
    const service = await build();

    expect(service.create('user-1')).not.toBe(service.create('user-2'));
  });

  /** O link fica dentro de um e-mail que pode ser aberto meses depois. */
  it('emite sempre o mesmo token para a mesma pessoa', async () => {
    const service = await build();

    expect(service.create('user-1')).toBe(service.create('user-1'));
  });

  it('recusa assinatura trocada', async () => {
    const service = await build();
    const token = service.create('user-1');
    const forged = `user-2.${token.split('.')[1]}`;

    expect(service.verify(forged)).toBeNull();
  });

  it('recusa token sem assinatura ou malformado', async () => {
    const service = await build();

    expect(service.verify('user-1')).toBeNull();
    expect(service.verify('')).toBeNull();
    expect(service.verify('.assinatura')).toBeNull();
    expect(service.verify('user-1.')).toBeNull();
  });

  /** Trocar o segredo invalida os links antigos, como deve. */
  it('recusa token assinado com outro segredo', async () => {
    const service = await build();
    const token = service.create('user-1');

    config.EMAIL_UNSUBSCRIBE_SECRET = 'outro-segredo';
    const other = await build();

    expect(other.verify(token)).toBeNull();
  });

  it('cai no segredo do JWT quando não há o dedicado', async () => {
    config.EMAIL_UNSUBSCRIBE_SECRET = undefined;
    config.JWT_SECRET = 'segredo-da-sessao';

    const service = await build();
    const token = service.create('user-1');

    expect(service.verify(token)).toBe('user-1');
  });

  /** Sem segredo, qualquer um forjaria o token e descadastraria terceiros. */
  it('falha alto quando não há segredo configurado', async () => {
    config.EMAIL_UNSUBSCRIBE_SECRET = undefined;
    config.JWT_SECRET = undefined;

    const service = await build();

    expect(() => service.create('user-1')).toThrow(/EMAIL_UNSUBSCRIBE_SECRET/);
  });
});
