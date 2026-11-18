import { EnhanceIdeaTextService } from './enhance-idea-text.service';
import { IdeaAiGatewayProvider } from '../providers/idea-ai-gateway.provider';
import { IdeaEssenceGuardService } from './idea-essence-guard.service';
import { settings } from '../testing/fixtures';
import { MediaType } from 'src/shared/media/media-item/media-item.entity';
import { IDEA_AI_ADMIN_INSTRUCTIONS_PREFIX } from '../constants';

describe('EnhanceIdeaTextService', () => {
  const gateway = { json: jest.fn() };
  const guard = { verify: jest.fn() };
  const service = new EnhanceIdeaTextService(
    gateway as unknown as IdeaAiGatewayProvider,
    guard as unknown as IdeaEssenceGuardService,
  );
  const title = 'Gincana das bolas';
  const description = 'Separe 3 bolas e leia João 3:16 com as crianças.';
  beforeEach(() => {
    jest.resetAllMocks();
    guard.verify.mockResolvedValue({ approved: true, violations: [] });
  });

  it('passes admin instructions and keeps both approved fields', async () => {
    gateway.json.mockResolvedValue({
      title: 'Gincana das bolas',
      description: 'Separe 3 bolas e, com as crianças, leia João 3:16.',
      changes: [],
    });
    const result = await service.enhance(
      settings,
      title,
      description,
      'Mais curto',
    );
    expect(result.guard.approved).toBe(true);
    expect(result.title).toBe('Gincana das bolas');
    const calls = gateway.json.mock.calls as unknown as Array<
      [unknown, { instructions: string }]
    >;
    const request = calls[0][1];
    expect(request.instructions).toContain(
      `${IDEA_AI_ADMIN_INSTRUCTIONS_PREFIX} Mais curto`,
    );
  });

  it('sends the materials as context and still guards against facts taken from them', async () => {
    gateway.json.mockResolvedValue({
      title: 'Gincana das bolas',
      description: 'Separe 3 bolas e leia João 3:16. Forme 4 grupos.',
      changes: [],
    });
    const result = await service.enhance(settings, title, description, null, [
      { name: 'molde.pdf', type: MediaType.DOCUMENT, text: 'Forme 4 grupos.' },
      { name: 'foto.png', type: MediaType.IMAGE, text: null },
    ]);
    const calls = gateway.json.mock.calls as unknown as Array<
      [unknown, { data: unknown }]
    >;
    expect(calls[0][1].data).toEqual({
      title,
      description,
      materials: [
        { name: 'molde.pdf', extractedText: 'Forme 4 grupos.' },
        { name: 'foto.png', extractedText: null },
      ],
    });
    // O número 4 veio do arquivo, não do professor na descrição: a guarda barra.
    expect(result.description).toBeNull();
  });

  it('keeps a good title when the description loses a fact', async () => {
    gateway.json.mockResolvedValue({
      title: 'Gincana das bolas',
      description: 'Separe bolas e leia a Bíblia com as crianças.',
      changes: [],
    });
    const result = await service.enhance(settings, title, description);
    expect(result.title).toBe('Gincana das bolas');
    expect(result.description).toBeNull();
    expect(result.guard.fields?.description.approved).toBe(false);
    // The judge sees the original description in place of the rejected one.
    expect(guard.verify).toHaveBeenCalledWith(
      settings,
      `${title}\n${description}`,
      `Gincana das bolas\n${description}`,
    );
  });

  it('skips the judge when both fields fail the deterministic checks', async () => {
    gateway.json.mockResolvedValue({
      title: '',
      description: 'Sem fatos.',
      changes: [],
    });
    const result = await service.enhance(settings, title, description);
    expect(guard.verify).not.toHaveBeenCalled();
    expect(result.title).toBeNull();
    expect(result.description).toBeNull();
  });

  it('rejects both fields when the judge rejects', async () => {
    gateway.json.mockResolvedValue({
      title,
      description,
      changes: [],
    });
    guard.verify.mockResolvedValue({
      approved: false,
      violations: ['Essência alterada.'],
    });
    const result = await service.enhance(settings, title, description);
    expect(result.title).toBeNull();
    expect(result.description).toBeNull();
  });
});
