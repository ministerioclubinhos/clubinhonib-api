import { Test } from '@nestjs/testing';

import { ChildEntity } from 'src/modules/children/entities/child.entity';
import { GetClubRecipientsService } from 'src/modules/clubs/services/get-club-recipients.service';
import { EmailService } from 'src/shared/email';
import { SiteUrlService } from 'src/shared/site-url';

import { AcceptedChristEntity } from '../entities/accepted-christ.entity';
import { DecisionType } from '../enums/decision-type.enum';
import { NotifyAcceptedChristService } from './notify-accepted-christ.service';

const flush = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

const NOW = new Date('2026-04-12T18:30:00Z');

const child = (clubId: string | null = 'club-1'): ChildEntity =>
  ({
    id: 'child-1',
    name: 'Joana',
    club: clubId ? { id: clubId, number: 12 } : null,
  }) as ChildEntity;

const decision = (
  value: DecisionType | null = DecisionType.ACCEPTED,
): AcceptedChristEntity =>
  ({
    id: 'decision-1',
    decision: value,
    notes: 'Conversou com a professora depois da aula.',
    createdAt: NOW,
  }) as AcceptedChristEntity;

const teacher = { id: 'teacher-1', name: 'Ana', email: 'ana@exemplo.com' };
const coordinator = { id: 'coord-1', name: 'Bia', email: 'bia@exemplo.com' };

describe('NotifyAcceptedChristService', () => {
  const getClubRecipientsService = { forClub: jest.fn() };
  const emailService = { sendAcceptedChristRegistered: jest.fn() };
  const siteUrlService = {
    baseUrl: 'https://clubinhonib.com',
    buildUrl: (...segments: string[]): string =>
      `https://clubinhonib.com/${segments.join('/')}`,
  };

  let service: NotifyAcceptedChristService;

  beforeEach(async () => {
    jest.clearAllMocks();
    emailService.sendAcceptedChristRegistered.mockResolvedValue({
      recipients: 2,
      sent: 2,
      failed: 0,
    });
    getClubRecipientsService.forClub.mockResolvedValue({
      clubId: 'club-1',
      clubNumber: 12,
      teachers: [teacher],
      coordinator,
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotifyAcceptedChristService,
        {
          provide: GetClubRecipientsService,
          useValue: getClubRecipientsService,
        },
        { provide: EmailService, useValue: emailService },
        { provide: SiteUrlService, useValue: siteUrlService },
      ],
    }).compile();

    service = moduleRef.get(NotifyAcceptedChristService);
  });

  it('avisa o coordenador e os professores do clubinho da criança', async () => {
    await service.notify(decision(), child());

    expect(getClubRecipientsService.forClub).toHaveBeenCalledWith('club-1');
    expect(emailService.sendAcceptedChristRegistered).toHaveBeenCalledWith(
      [teacher, coordinator],
      expect.objectContaining({
        childName: 'Joana',
        clubNumber: 12,
        decision: 'Aceitou a Jesus',
      }),
    );
  });

  /**
   * A observação é escrita para o registro, muitas vezes com detalhes da
   * conversa; a lista de destinatários é maior do que quem escreveu previa.
   */
  it('não envia a observação de quem registrou', async () => {
    await service.notify(decision(), child());

    const [, data] = emailService.sendAcceptedChristRegistered.mock
      .calls[0] as [unknown, Record<string, unknown>];

    expect(JSON.stringify(data)).not.toContain('Conversou com a professora');
  });

  /** A coluna é anulável: quem registra nem sempre marca qual foi a decisão. */
  it('usa um rótulo neutro quando a decisão não foi especificada', async () => {
    await service.notify(decision(null), child());

    expect(emailService.sendAcceptedChristRegistered).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ decision: 'Decisão registrada' }),
    );
  });

  /** O vínculo com o clubinho é anulável; não é erro. */
  it('não envia nada quando a criança está sem clubinho', async () => {
    await service.notify(decision(), child(null));

    expect(emailService.sendAcceptedChristRegistered).not.toHaveBeenCalled();
  });

  it('não envia nada quando o clubinho não tem destinatário elegível', async () => {
    getClubRecipientsService.forClub.mockResolvedValue({
      clubId: 'club-1',
      clubNumber: 12,
      teachers: [],
      coordinator: null,
    });

    await service.notify(decision(), child());

    expect(emailService.sendAcceptedChristRegistered).not.toHaveBeenCalled();
  });

  it('engole a falha do envio em segundo plano', async () => {
    getClubRecipientsService.forClub.mockRejectedValue(new Error('banco fora'));

    expect(() => service.notifyInBackground(decision(), child())).not.toThrow();
    await flush();
  });
});
