import { Test } from '@nestjs/testing';

import { GetUsersService } from 'src/core/user/services/get-user.service';
import { EmailService } from 'src/shared/email';
import { SiteUrlService } from 'src/shared/site-url';

import { DocumentEntity } from '../entities/document.entity';
import { AnnounceDocumentService } from './announce-document.service';

const flush = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

const document = (path?: string): DocumentEntity =>
  ({
    id: 'doc-1',
    name: 'Manual do professor',
    description: 'Como conduzir a visita semanal.',
    route: path ? { path } : null,
  }) as DocumentEntity;

describe('AnnounceDocumentService', () => {
  const emailService = { sendDocumentPublished: jest.fn() };
  const getUsersService = { findActiveRecipients: jest.fn() };
  const siteUrlService = {
    baseUrl: 'https://clubinhonib.com',
    buildUrl: (...segments: string[]): string =>
      `https://clubinhonib.com/${segments.join('/')}`,
  };

  let service: AnnounceDocumentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    emailService.sendDocumentPublished.mockResolvedValue({
      recipients: 1,
      sent: 1,
      failed: 0,
    });
    getUsersService.findActiveRecipients.mockResolvedValue([
      { id: 'u1', name: 'Ana', email: 'ana@exemplo.com' },
    ]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        AnnounceDocumentService,
        { provide: EmailService, useValue: emailService },
        { provide: GetUsersService, useValue: getUsersService },
        { provide: SiteUrlService, useValue: siteUrlService },
      ],
    }).compile();

    service = moduleRef.get(AnnounceDocumentService);
  });

  it('avisa a base com o link do documento', async () => {
    await service.announce(document('documento_manual'));

    expect(emailService.sendDocumentPublished).toHaveBeenCalledWith(
      [{ id: 'u1', name: 'Ana', email: 'ana@exemplo.com' }],
      {
        name: 'Manual do professor',
        description: 'Como conduzir a visita semanal.',
        documentLink: 'https://clubinhonib.com/documento_manual',
      },
    );
  });

  /** Um aviso sem link não serve para nada. */
  it('não envia nada quando o documento está sem rota', async () => {
    await service.announce(document());

    expect(emailService.sendDocumentPublished).not.toHaveBeenCalled();
  });

  /** O documento já está publicado quando o aviso começa. */
  it('engole a falha do envio em segundo plano', async () => {
    getUsersService.findActiveRecipients.mockRejectedValue(
      new Error('banco fora'),
    );

    expect(() =>
      service.announceInBackground(document('documento_manual')),
    ).not.toThrow();
    await flush();
  });
});
