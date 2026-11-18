import { Test } from '@nestjs/testing';

import { GetUsersService } from 'src/core/user/services/get-user.service';
import { EmailService } from 'src/shared/email';
import { SiteUrlService } from 'src/shared/site-url';

import { InformativeEntity } from '../entities/informative.entity';
import { AnnounceInformativeService } from './announce-informative.service';

const flush = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

const informative = (path?: string): InformativeEntity =>
  ({
    id: 'inf-1',
    title: 'Retiro de professores',
    description: 'Inscrições abertas até sexta.',
    route: path ? { path } : null,
  }) as InformativeEntity;

describe('AnnounceInformativeService', () => {
  const emailService = { sendInformativePublished: jest.fn() };
  const getUsersService = { findActiveRecipients: jest.fn() };
  const siteUrlService = {
    baseUrl: 'https://clubinhonib.com',
    buildUrl: (...segments: string[]): string =>
      `https://clubinhonib.com/${segments.join('/')}`,
  };

  let service: AnnounceInformativeService;

  beforeEach(async () => {
    jest.clearAllMocks();
    emailService.sendInformativePublished.mockResolvedValue({
      recipients: 1,
      sent: 1,
      failed: 0,
    });
    getUsersService.findActiveRecipients.mockResolvedValue([
      { id: 'u1', name: 'Ana', email: 'ana@exemplo.com' },
    ]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        AnnounceInformativeService,
        { provide: EmailService, useValue: emailService },
        { provide: GetUsersService, useValue: getUsersService },
        { provide: SiteUrlService, useValue: siteUrlService },
      ],
    }).compile();

    service = moduleRef.get(AnnounceInformativeService);
  });

  it('avisa a base com o link do informativo', async () => {
    await service.announce(informative('informativo_retiro'));

    expect(emailService.sendInformativePublished).toHaveBeenCalledWith(
      [{ id: 'u1', name: 'Ana', email: 'ana@exemplo.com' }],
      {
        title: 'Retiro de professores',
        description: 'Inscrições abertas até sexta.',
        informativeLink: 'https://clubinhonib.com/informativo_retiro',
      },
    );
  });

  /** Um aviso sem link não serve para nada. */
  it('não envia nada quando o informativo está sem rota', async () => {
    await service.announce(informative());

    expect(emailService.sendInformativePublished).not.toHaveBeenCalled();
  });

  /** O informativo já está publicado quando o aviso começa. */
  it('engole a falha do envio em segundo plano', async () => {
    getUsersService.findActiveRecipients.mockRejectedValue(
      new Error('banco fora'),
    );

    expect(() =>
      service.announceInBackground(informative('informativo_retiro')),
    ).not.toThrow();
    await flush();
  });
});
