import { Test } from '@nestjs/testing';
import { EmailService } from 'src/shared/email';
import { SiteUrlService } from 'src/shared/site-url';
import { GetUsersService } from 'src/core/user/services/get-user.service';
import { EventEntity } from '../entities/event.entity';
import { AnnounceEventService } from './announce-event.service';

const buildEvent = (overrides: Partial<EventEntity> = {}): EventEntity =>
  Object.assign(new EventEntity(), {
    id: 'event-1',
    title: 'Festa da Família',
    date: '2026-04-12',
    location: 'Salão da igreja',
    description: 'Traga a família toda.',
    ...overrides,
  });

describe('AnnounceEventService', () => {
  const emailService = {
    sendEventCreated: jest.fn(),
    sendEventUpdated: jest.fn(),
    sendEventCancelled: jest.fn(),
  };
  const getUsersService = { findActiveRecipients: jest.fn() };
  const siteUrlService = {
    baseUrl: 'https://clubinhonib.com',
    buildUrl: (...segments: string[]) =>
      `https://clubinhonib.com/${segments.join('/')}`,
  };

  let service: AnnounceEventService;

  beforeEach(async () => {
    jest.clearAllMocks();
    getUsersService.findActiveRecipients.mockResolvedValue([
      { id: 'user-1', name: 'Ana', email: 'ana@exemplo.com' },
    ]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        AnnounceEventService,
        { provide: EmailService, useValue: emailService },
        { provide: GetUsersService, useValue: getUsersService },
        { provide: SiteUrlService, useValue: siteUrlService },
      ],
    }).compile();

    service = moduleRef.get(AnnounceEventService);
  });

  it.each([
    ['created', 'sendEventCreated'],
    ['updated', 'sendEventUpdated'],
    ['cancelled', 'sendEventCancelled'],
  ] as const)('usa o e-mail de %s', async (change, method) => {
    await service.announce(change, buildEvent());

    // Os destinatários vão identificados: o rodapé de cada mensagem leva um
    // link de descadastro assinado para aquela pessoa.
    expect(emailService[method]).toHaveBeenCalledWith(
      [{ id: 'user-1', name: 'Ana', email: 'ana@exemplo.com' }],
      expect.objectContaining({ title: 'Festa da Família' }),
    );
  });

  it.each([
    ['created', 'sendEventCreated'],
    ['updated', 'sendEventUpdated'],
    ['cancelled', 'sendEventCancelled'],
  ] as const)(
    'não avisa ninguém sobre encontro de clubinho em %s',
    async (change, method) => {
      // O encontro nasce do cadastro administrativo do clubinho e se repete
      // toda semana: avisar a base a cada criação, edição ou exclusão seria
      // ruído — e "evento cancelado" sobre um clubinho que continua existindo
      // seria pior que ruído.
      const encontro = Object.assign(buildEvent(), { clubId: 'club-1' });

      await service.announce(change, encontro);

      expect(emailService[method]).not.toHaveBeenCalled();
      expect(getUsersService.findActiveRecipients).not.toHaveBeenCalled();
    },
  );

  it('aponta para a agenda, já que evento não tem página própria', async () => {
    await service.announce('created', buildEvent());

    const [[, data]] = emailService.sendEventCreated.mock.calls as [
      [string[], { agendaLink: string }],
    ];
    expect(data.agendaLink).toBe('https://clubinhonib.com/eventos');
  });

  it('envia só para usuários já validados, pelo serviço de usuários', async () => {
    await service.announce('created', buildEvent());

    expect(getUsersService.findActiveRecipients).toHaveBeenCalledTimes(1);
  });

  it('em segundo plano, engole a falha para não derrubar a operação', async () => {
    emailService.sendEventCreated.mockRejectedValue(new Error('smtp caiu'));

    expect(() =>
      service.announceInBackground('created', buildEvent()),
    ).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));
  });
});
