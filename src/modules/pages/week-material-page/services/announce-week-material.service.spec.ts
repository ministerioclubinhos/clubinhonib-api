import { Test } from '@nestjs/testing';
import { EmailService } from 'src/shared/email';
import { SiteUrlService } from 'src/shared/site-url';
import { GetUsersService } from 'src/core/user/services/get-user.service';
import { WeekMaterialsPageEntity } from '../entities/week-material-page.entity';
import { AnnounceWeekMaterialService } from './announce-week-material.service';

const buildPage = (
  overrides: Partial<WeekMaterialsPageEntity> = {},
): WeekMaterialsPageEntity =>
  Object.assign(new WeekMaterialsPageEntity(), {
    id: 'page-1',
    title: 'Semana 12',
    subtitle: 'Tema da semana',
    description: 'Materiais da visita',
    route: { path: 'materiais_semanal_semana-12' },
    ...overrides,
  });

describe('AnnounceWeekMaterialService', () => {
  const emailService = { sendWeekMaterialAnnouncement: jest.fn() };
  const getUsersService = { findActiveRecipients: jest.fn() };
  const siteUrlService = {
    baseUrl: 'https://clubinhonib.com',
    buildUrl: (...segments: string[]) =>
      `https://clubinhonib.com/${segments.join('/')}`,
  };

  let service: AnnounceWeekMaterialService;

  beforeEach(async () => {
    jest.clearAllMocks();
    getUsersService.findActiveRecipients.mockResolvedValue([
      { id: 'user-1', name: 'Ana', email: 'ana@exemplo.com' },
      { id: 'user-2', name: 'Bia', email: 'bia@exemplo.com' },
    ]);
    emailService.sendWeekMaterialAnnouncement.mockResolvedValue({
      recipients: 2,
      sent: 2,
      failed: 0,
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        AnnounceWeekMaterialService,
        { provide: EmailService, useValue: emailService },
        { provide: GetUsersService, useValue: getUsersService },
        { provide: SiteUrlService, useValue: siteUrlService },
      ],
    }).compile();

    service = moduleRef.get(AnnounceWeekMaterialService);
  });

  it('envia para os usuários já validados, com o link da página', async () => {
    await service.announce(buildPage());

    // Os destinatários vão identificados: o rodapé de cada mensagem leva um
    // link de descadastro assinado para aquela pessoa.
    expect(emailService.sendWeekMaterialAnnouncement).toHaveBeenCalledWith(
      [
        { id: 'user-1', name: 'Ana', email: 'ana@exemplo.com' },
        { id: 'user-2', name: 'Bia', email: 'bia@exemplo.com' },
      ],
      expect.objectContaining({
        title: 'Semana 12',
        materialLink: 'https://clubinhonib.com/materiais_semanal_semana-12',
      }),
    );
  });

  it('nunca envia os marcadores internos da descrição', async () => {
    await service.announce(
      buildPage({
        description:
          'Material completo da semana 12, revisado e aprovado. [origem:licao:2f6f0c1e-0000-4000-8000-000000000000]',
      }),
    );

    expect(emailService.sendWeekMaterialAnnouncement).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        description: 'Material completo da semana 12, revisado e aprovado.',
        special: false,
      }),
    );
  });

  it('avisa o Material Especial como especial, sem a marca de tipo no texto', async () => {
    await service.announce(
      buildPage({
        title: 'Material Especial — O Picolé Roubado',
        description:
          'Material Especial completo, revisado e aprovado. [tipo:especial] [origem:licao:abc]',
      }),
    );

    expect(emailService.sendWeekMaterialAnnouncement).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        title: 'Material Especial — O Picolé Roubado',
        description: 'Material Especial completo, revisado e aprovado.',
        special: true,
      }),
    );
  });

  it('pede ao serviço de usuários, não ao repositório de outro módul', async () => {
    await service.announce(buildPage());

    expect(getUsersService.findActiveRecipients).toHaveBeenCalledTimes(1);
  });

  it('não envia nada quando a página não tem rota', async () => {
    // Sem rota não existe link, e um aviso sem link não serve para nada.
    await service.announce(buildPage({ route: undefined }));

    expect(emailService.sendWeekMaterialAnnouncement).not.toHaveBeenCalled();
  });

  it('em segundo plano, engole a falha para não derrubar a criação', async () => {
    emailService.sendWeekMaterialAnnouncement.mockRejectedValue(
      new Error('smtp fora do ar'),
    );

    expect(() => service.announceInBackground(buildPage())).not.toThrow();
    // A promessa interna já foi tratada; nada escapa para quem chamou.
    await new Promise((resolve) => setImmediate(resolve));
  });

  it('não bloqueia quem chamou', () => {
    let resolveSend: () => void = () => undefined;
    emailService.sendWeekMaterialAnnouncement.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSend = resolve;
      }),
    );

    service.announceInBackground(buildPage());

    // O retorno é imediato, mesmo com o envio ainda pendente.
    expect(emailService.sendWeekMaterialAnnouncement).toHaveBeenCalledTimes(0);
    resolveSend();
  });
});
