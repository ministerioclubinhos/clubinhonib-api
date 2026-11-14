import {
  IMAGE_BRIEF_FIELD,
  IMAGE_BRIEF_PROMPT_HEADINGS,
  LESSON_IMAGE_BRIEF_SCHEMA,
} from '../constants/lesson-image-brief.constants';
import { LessonImageBriefOrigin } from '../enums/lesson-image-brief.enum';
import { LessonStageType } from '../enums/lesson.enums';
import {
  buildImageBriefRequest,
  imageBriefApplies,
  imagePlanFingerprint,
  parseImageBrief,
  plannedImagesOf,
  readImageBrief,
  withImageBrief,
  withImageBriefPart,
  withoutImageBrief,
} from './lesson-image-brief.utils';

const TYPE = LessonStageType.LESSON_VISUALS;
const content = () => ({
  visualConfig: { type: 'CUTOUT_KIT' },
  assets: [
    {
      id: 'kit-01',
      category: 'CHARACTERS',
      prompt: 'Jesus e Pedro',
      url: 'u1',
    },
    { id: 'kit-02', category: 'ANIMALS', prompt: 'Uma pomba', url: 'u2' },
  ],
});
const answer = () => ({
  artDirection: 'Aquarela digital, contorno marrom fino, paleta terrosa.',
  cast: [
    {
      name: 'Jesus',
      appearance: 'Homem de 30 anos, túnica bege, barba castanha.',
    },
    {
      name: 'Pedro',
      appearance: 'Homem de 40 anos, túnica azul, barba grisalha.',
    },
  ],
  settings: [
    { name: 'Casa', appearance: 'Casa de adobe com porta de madeira.' },
  ],
  parts: [
    {
      assetId: 'kit-01',
      prompt: 'Jesus e Pedro de corpo inteiro, lado a lado, isolados.',
      cast: ['jesus', 'Pedro', 'Maria'],
      settings: [],
    },
    {
      assetId: 'kit-02',
      prompt: 'Uma pomba branca de asas abertas, isolada.',
      cast: [],
      settings: ['Casa'],
    },
  ],
});
const planned = () => plannedImagesOf(TYPE, content());
const brief = () => {
  const parsed = parseImageBrief(
    answer(),
    planned(),
    LessonImageBriefOrigin.GENERATION,
    new Date('2026-11-12T12:00:00.000Z'),
  );
  if ('problem' in parsed) throw new Error(parsed.problem);
  return parsed.brief;
};

describe('prompt mestre de imagens — plano', () => {
  it('ignora o que a geração produziu (url) ao descrever o plano', () => {
    expect(planned()[0]).toEqual({
      id: 'kit-01',
      category: 'CHARACTERS',
      prompt: 'Jesus e Pedro',
    });
  });

  it('a impressão digital muda com o plano e não com as URLs', () => {
    const changedUrl = content();
    changedUrl.assets[0].url = 'outra';
    expect(imagePlanFingerprint(plannedImagesOf(TYPE, changedUrl))).toBe(
      imagePlanFingerprint(planned()),
    );
    const changedPlan = content();
    changedPlan.assets[1].prompt = 'Duas pombas';
    expect(imagePlanFingerprint(plannedImagesOf(TYPE, changedPlan))).not.toBe(
      imagePlanFingerprint(planned()),
    );
  });

  it('não se aplica à lição nem à meditação dos maiores', () => {
    expect(imageBriefApplies(LessonStageType.LESSON)).toBe(false);
    expect(imageBriefApplies(LessonStageType.MEDITATION_OLDER)).toBe(false);
    expect(imageBriefApplies(LessonStageType.MANUAL_WORK)).toBe(true);
  });
});

describe('prompt mestre de imagens — leitura da resposta', () => {
  it('monta uma parte por imagem e só aceita nomes das fichas', () => {
    const parsed = brief();
    expect(parsed.parts.map((part) => part.assetId)).toEqual([
      'kit-01',
      'kit-02',
    ]);
    // "jesus" is matched to the sheet name; "Maria" has no sheet and is dropped.
    expect(parsed.parts[0].cast).toEqual(['Jesus', 'Pedro']);
    expect(parsed.parts[1].settings).toEqual(['Casa']);
    expect(parsed.origin).toBe(LessonImageBriefOrigin.GENERATION);
  });

  it.each([
    ['direção de arte vazia', { artDirection: '  ' }],
    ['parte faltando', { parts: [answer().parts[0]] }],
    [
      'parte curta demais',
      { parts: [answer().parts[0], { ...answer().parts[1], prompt: 'pomba' }] },
    ],
  ])('recusa: %s', (_label, over) => {
    const parsed = parseImageBrief(
      { ...answer(), ...over },
      planned(),
      LessonImageBriefOrigin.GENERATION,
    );
    expect('problem' in parsed).toBe(true);
  });
});

describe('prompt mestre de imagens — reuso', () => {
  it('lê de volta o prompt guardado na versão', () => {
    const stored = withImageBrief(content(), brief());
    expect(readImageBrief(TYPE, stored)).toEqual(brief());
  });

  it('descarta o prompt guardado quando as imagens planejadas mudaram', () => {
    const stored = withImageBrief(content(), brief());
    (stored.assets as Array<{ prompt: string }>)[1].prompt = 'Duas pombas';
    expect(readImageBrief(TYPE, stored)).toBeNull();
  });

  it('não lê prompt de versão sem ele, nem de outro formato', () => {
    expect(readImageBrief(TYPE, content())).toBeNull();
    expect(
      readImageBrief(TYPE, {
        ...content(),
        [IMAGE_BRIEF_FIELD]: { ...brief(), version: 99 },
      }),
    ).toBeNull();
  });

  it('remove o prompt para que ele seja reescrito', () => {
    const cleared = withoutImageBrief(withImageBrief(content(), brief()));
    expect(IMAGE_BRIEF_FIELD in cleared).toBe(false);
    expect(cleared.assets).toEqual(content().assets);
  });
});

describe('prompt mestre de imagens — prompt de cada imagem', () => {
  it('acrescenta a direção de arte, as fichas de quem aparece e a parte da imagem', () => {
    const prompt = withImageBriefPart('REGRAS DO ITEM', brief(), 'kit-01');
    expect(prompt.startsWith('REGRAS DO ITEM')).toBe(true);
    expect(prompt).toContain(IMAGE_BRIEF_PROMPT_HEADINGS.artDirection);
    expect(prompt).toContain('Aquarela digital');
    expect(prompt).toContain('- Jesus: Homem de 30 anos');
    expect(prompt).toContain('- Pedro: Homem de 40 anos');
    expect(prompt).toContain('Jesus e Pedro de corpo inteiro');
    // The other image's part never leaks into this one.
    expect(prompt).not.toContain('pomba branca');
  });

  it('imagem sem personagens não recebe ficha de personagem', () => {
    const prompt = withImageBriefPart('REGRAS DO ITEM', brief(), 'kit-02');
    expect(prompt).not.toContain(IMAGE_BRIEF_PROMPT_HEADINGS.cast);
    expect(prompt).not.toContain('Homem de 30 anos');
    expect(prompt).toContain('- Casa: Casa de adobe');
    expect(prompt).toContain('pomba branca');
  });

  it('sem prompt mestre, o prompt do item fica como era', () => {
    expect(withImageBriefPart('REGRAS DO ITEM', null, 'kit-01')).toBe(
      'REGRAS DO ITEM',
    );
    expect(withImageBriefPart('REGRAS DO ITEM', brief(), 'kit-99')).toBe(
      'REGRAS DO ITEM',
    );
  });
});

describe('prompt mestre de imagens — pedido ao diretor de arte', () => {
  it('junta as regras-base, as orientações do administrador, a lição e o plano', () => {
    const request = buildImageBriefRequest({
      theme: 'O maior no Reino',
      biblicalReference: 'Mateus 18',
      category: 'REGULAR',
      stage: TYPE,
      adminGuidance: 'BASE DA ETAPA + sem tons escuros',
      story: 'Jesus chamou uma criança.',
      memoryVerse: { text: 'Deixem vir a mim', reference: 'Mt 19.14' },
      visualConfig: { type: 'CUTOUT_KIT' },
      stageContent: { coverageChecklist: [] },
      plannedImages: planned(),
    });
    const user = JSON.parse(request.user) as Record<string, unknown>;
    expect(request.system).toContain('PROMPT MESTRE DE IMAGENS');
    expect(request.schema).toBe(LESSON_IMAGE_BRIEF_SCHEMA);
    expect(user.orientacoesDoAdministrador).toBe(
      'BASE DA ETAPA + sem tons escuros',
    );
    expect(user.licao).toMatchObject({ historia: 'Jesus chamou uma criança.' });
    expect(user.imagensPlanejadas).toEqual(planned());
  });
});
