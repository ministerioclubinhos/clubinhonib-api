import { LessonImageBriefOrigin } from '../enums/lesson-image-brief.enum';
import { LessonCategory, LessonStageType } from '../enums/lesson.enums';
import type {
  LessonLlmGenerationInput,
  LessonLlmProviderContract,
} from '../providers/lesson-llm.types';
import { readImageBrief } from '../utils/lesson-image-brief.utils';
import { LessonImageBriefService } from './lesson-image-brief.service';

const TYPE = LessonStageType.VERSE_FIXATION;
const content = () => ({
  name: 'Corrida do versículo',
  assets: [
    { id: '1', prompt: 'Crianças em fila', url: 'u1' },
    { id: '2', prompt: 'Criança com cartão', url: 'u2' },
  ],
});
const answer = (ids: string[] = ['1', '2']) => ({
  content: {
    artDirection: 'Traço limpo, cores vivas.',
    cast: [{ name: 'Ana', appearance: 'Menina de 8 anos, vestido amarelo.' }],
    settings: [],
    parts: ids.map((assetId) => ({
      assetId,
      prompt: `Cena da imagem ${assetId} com detalhes suficientes.`,
      cast: ['Ana'],
      settings: [],
    })),
  },
  responseId: 'resp-brief',
});
const generationInput = {
  theme: 'Tema',
  biblicalReference: 'João 3:16',
  category: LessonCategory.REGULAR,
  stage: TYPE,
} as LessonLlmGenerationInput;

describe('LessonImageBriefService', () => {
  const service = new LessonImageBriefService();
  const generateStructured = jest.fn();
  const llm = { generateStructured } as unknown as LessonLlmProviderContract;
  const ensure = (
    value: Record<string, unknown> = content(),
    provider: LessonLlmProviderContract = llm,
    type: LessonStageType = TYPE,
  ) =>
    service.ensure(provider, {
      type,
      content: value,
      canonicalLesson: { story: 'História', memoryVerse: { text: 'Verso' } },
      adminPrompt: 'BASE + ORIENTAÇÃO',
      generationInput,
      origin: LessonImageBriefOrigin.GENERATION,
    });

  beforeEach(() => jest.resetAllMocks());

  it('escreve o prompt mestre uma vez, a partir de base, orientação e lição', async () => {
    generateStructured.mockResolvedValue(answer());

    const result = await ensure();

    expect(generateStructured).toHaveBeenCalledTimes(1);
    const [request] = generateStructured.mock.calls[0] as [
      { system: string; user: string },
    ];
    expect(request.user).toContain('BASE + ORIENTAÇÃO');
    expect(request.user).toContain('História');
    expect(readImageBrief(TYPE, result)?.parts).toHaveLength(2);
  });

  it('reaproveita o prompt que a versão já tem, sem nova chamada', async () => {
    generateStructured.mockResolvedValue(answer());
    const first = await ensure();
    generateStructured.mockClear();

    const second = await ensure(first);

    expect(generateStructured).not.toHaveBeenCalled();
    expect(second).toBe(first);
  });

  it('tenta de novo quando a resposta não cobre todas as imagens', async () => {
    generateStructured
      .mockResolvedValueOnce(answer(['1']))
      .mockResolvedValueOnce(answer());

    const result = await ensure();

    expect(generateStructured).toHaveBeenCalledTimes(2);
    expect(readImageBrief(TYPE, result)).not.toBeNull();
  });

  it('nunca derruba a geração: sem prompt mestre, devolve o conteúdo como veio', async () => {
    generateStructured.mockRejectedValue(new Error('provedor fora do ar'));
    const original = content();

    const result = await ensure(original);

    expect(generateStructured).toHaveBeenCalledTimes(2);
    expect(result).toBe(original);
  });

  it('não chama a IA para itens sem imagens, fora do escopo ou sem suporte', async () => {
    const noImages = { name: 'Sem arte' };
    expect(await ensure(noImages)).toBe(noImages);
    const older = content();
    expect(await ensure(older, llm, LessonStageType.MEDITATION_OLDER)).toBe(
      older,
    );
    const plain = content();
    expect(await ensure(plain, {} as LessonLlmProviderContract)).toBe(plain);
    expect(generateStructured).not.toHaveBeenCalled();
  });
});
