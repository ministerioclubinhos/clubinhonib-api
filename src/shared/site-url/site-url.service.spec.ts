import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SiteUrlService } from './site-url.service';

const buildService = async (
  config: Record<string, string>,
): Promise<SiteUrlService> => {
  const moduleRef = await Test.createTestingModule({
    providers: [
      SiteUrlService,
      {
        provide: ConfigService,
        useValue: { get: (key: string) => config[key] },
      },
    ],
  }).compile();

  return moduleRef.get(SiteUrlService);
};

describe('SiteUrlService', () => {
  it('usa SITE_BASE_URL quando informado, sem a barra final', async () => {
    const service = await buildService({
      SITE_BASE_URL: 'https://clubinhonib.com/',
      ENVIRONMENT: 'local',
    });

    expect(service.baseUrl).toBe('https://clubinhonib.com');
  });

  it('cai no mapa por ambiente quando a variável não existe', async () => {
    await expect(
      buildService({ ENVIRONMENT: 'production' }).then((s) => s.baseUrl),
    ).resolves.toBe('https://clubinhonib.com');
    await expect(
      buildService({ ENVIRONMENT: 'staging' }).then((s) => s.baseUrl),
    ).resolves.toBe('https://staging.clubinhonib.com');
  });

  it('reconhece o ambiente dev, que antes caía no padrão', async () => {
    // O mapa antigo só tinha local, staging e production: em dev, o link de
    // recuperação era enviado apontando para localhost.
    const service = await buildService({ ENVIRONMENT: 'dev' });

    expect(service.baseUrl).toBe('http://localhost:5173');
  });

  it('avisa e usa o padrão em ambiente desconhecido', async () => {
    const service = await buildService({ ENVIRONMENT: 'homolog' });

    expect(service.baseUrl).toBe('http://localhost:5173');
  });

  it('monta o link juntando os segmentos sem barra duplicada', async () => {
    const service = await buildService({
      SITE_BASE_URL: 'https://clubinhonib.com',
    });

    expect(service.buildUrl('confirmar-email', 'abc123')).toBe(
      'https://clubinhonib.com/confirmar-email/abc123',
    );
    expect(service.buildUrl('/recuperar-senha/', '/xyz/')).toBe(
      'https://clubinhonib.com/recuperar-senha/xyz',
    );
  });
});
