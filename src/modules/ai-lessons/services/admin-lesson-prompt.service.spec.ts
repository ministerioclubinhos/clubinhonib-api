import { ConflictException } from '@nestjs/common';
import { AdminLessonPromptEntity } from '../entities/admin-lesson-prompt.entity';
import {
  LESSON_SHARED_QUALITY_RULES,
  LESSON_STAGE_QUALITY_RULES,
} from '../constants/lesson-quality.constants';
import { LESSON_TEMPLATES } from '../templates/lesson-templates';
import { LESSON_STAGE_ORDER, LessonStageType } from '../enums/lesson.enums';
import { AdminLessonPromptService } from './admin-lesson-prompt.service';
import { AdminLessonPromptRepository } from '../repositories/admin-lesson-prompt.repository';

describe('AdminLessonPromptService', () => {
  const records: AdminLessonPromptEntity[] = [];
  const repository = {
    findByAdminId: jest.fn((adminId: string) =>
      Promise.resolve(records.filter((item) => item.adminId === adminId)),
    ),
    findByAdminIdAndStage: jest.fn((adminId: string, stage: LessonStageType) =>
      Promise.resolve(
        records.find(
          (item) => item.adminId === adminId && item.stage === stage,
        ) ?? null,
      ),
    ),
    createPrompt: jest.fn((input: Partial<AdminLessonPromptEntity>) =>
      Object.assign(new AdminLessonPromptEntity(), input, {
        id: 'prompt-1',
        lockVersion: 1,
      }),
    ),
    savePrompt: jest.fn((entity: AdminLessonPromptEntity) => {
      const index = records.findIndex((item) => item.id === entity.id);
      if (index >= 0) {
        entity.lockVersion += 1;
        records[index] = entity;
      } else records.push(entity);
      return Promise.resolve(entity);
    }),
    // Same contract as the SQL compare-and-swap: one row, only at that version.
    updatePromptWhereVersion: jest.fn(
      (id: string, expectedLockVersion: number, customPrompt: string) => {
        const record = records.find(
          (item) => item.id === id && item.lockVersion === expectedLockVersion,
        );
        if (!record) return Promise.resolve(false);
        record.customPrompt = customPrompt;
        record.lockVersion += 1;
        return Promise.resolve(true);
      },
    ),
  };
  const service = new AdminLessonPromptService(
    repository as unknown as AdminLessonPromptRepository,
  );

  beforeEach(() => {
    records.splice(0);
    jest.clearAllMocks();
  });

  it('entrega os oito prompts-base para um administrador novo', async () => {
    const result = await service.list('admin-a');
    expect(result).toHaveLength(8);
    expect(
      result.every(
        (item) =>
          item.customPrompt === null &&
          item.effectivePrompt === item.basePrompt,
      ),
    ).toBe(true);
  });

  it.each(LESSON_STAGE_ORDER)(
    'preserva critérios gerais e específicos no prompt personalizado de %s',
    async (stage) => {
      const saved = await service.save(
        'admin-a',
        stage,
        'Use recursos disponíveis na sala.',
      );
      const effective = await service.effective('admin-a', stage);
      expect(effective).toBe(saved.effectivePrompt);
      expect(effective).toContain('Use recursos disponíveis na sala.');
      expect(effective).toContain('A orientação complementar não substitui');
      expect(saved.basePrompt).toContain(LESSON_STAGE_QUALITY_RULES[stage]);
      for (const rule of LESSON_SHARED_QUALITY_RULES) {
        expect(saved.basePrompt).toContain(rule);
        expect(effective).toContain(rule);
        expect(LESSON_TEMPLATES[stage].rules).toContain(rule);
      }
    },
  );

  it.each([
    [LessonStageType.MEDITATION_YOUNGER, '5 a 8 anos', 'labirinto de letras'],
    [LessonStageType.MEDITATION_OLDER, '8 a 12 anos', 'cruzadinha'],
  ])(
    'preserva idade e desafios temáticos completos para %s',
    async (stage, age, activity) => {
      const result = await service.save(
        'admin-a',
        stage,
        'Use o tema aprovado.',
      );
      expect(result.effectivePrompt).toContain(age);
      expect(result.effectivePrompt).toContain(activity);
      expect(result.effectivePrompt).toContain('tema');
      expect(result.effectivePrompt).toContain('gabarito');
      expect(result.effectivePrompt).toContain('solução');
      expect(result.effectivePrompt).toContain('Use o tema aprovado.');
    },
  );

  it('isola a personalização por administrador e etapa', async () => {
    await service.save(
      'admin-a',
      LessonStageType.LESSON,
      'Minha orientação pessoal para a lição.',
    );
    const effective = await service.effective(
      'admin-a',
      LessonStageType.LESSON,
    );
    expect(effective).toContain('Minha orientação pessoal para a lição.');
    expect(effective).toContain('ORDEM OBRIGATÓRIA DO CONTEÚDO');
    expect(
      await service.effective('admin-b', LessonStageType.LESSON),
    ).not.toContain('Minha orientação pessoal para a lição.');
    expect(
      (await service.list('admin-a')).find(
        (item) => item.stage === LessonStageType.LESSON_VISUALS,
      )?.customPrompt,
    ).toBeNull();
  });

  it('informa quando o administrador salvou a orientação, e nada para quem nunca personalizou', async () => {
    const [untouched] = await service.list('admin-1');
    expect(untouched.updatedAt).toBeNull();

    const savedAt = new Date('2026-11-11T15:30:00.000Z');
    records.push(
      Object.assign(new AdminLessonPromptEntity(), {
        id: 'prompt-9',
        adminId: 'admin-1',
        stage: LessonStageType.LESSON,
        customPrompt: 'Use frases curtas e exemplos do dia a dia.',
        lockVersion: 1,
        updatedAt: savedAt,
      }),
    );

    const [mine] = await service.list('admin-1');
    const [theirs] = await service.list('admin-2');
    expect(mine.updatedAt).toBe(savedAt.toISOString());
    // A orientação é pessoal: outro administrador não a recebe.
    expect(theirs.updatedAt).toBeNull();
    expect(theirs.customPrompt).toBeNull();
  });

  it('fornece referências reais e mantém a aula participativa mesmo com personalização', async () => {
    await service.save(
      'admin-a',
      LessonStageType.LESSON,
      'Use objetos simples da sala.',
    );
    const prompt = await service.effective('admin-a', LessonStageType.LESSON);
    expect(prompt).toContain('aula completa pronta para ministrar');
    expect(prompt).toContain('(aguarde as respostas)');
    expect(prompt).toContain('Nunca copie essas descrições para story');
    expect(prompt).toContain('João 11:25, sem acrescentar 11:26');
    expect(prompt).toContain('Hebreus 9:22b');
    expect(prompt).toContain('1 Coríntios 15:3b-4');
    expect(prompt).toContain('Não omita Tomé');
    expect(prompt).toContain('LIÇÕES COM DUAS OU MAIS SUB-HISTÓRIAS');
    expect(prompt).toContain('prefixo exato "### "');
    expect(prompt).toContain('Semana 15');
    expect(prompt).toContain('Nunca misture essas quantidades');
    expect(prompt).toContain('devolva string vazia');
    expect(prompt).toContain('o número da semana sozinho não autoriza');
    expect(prompt).toContain(
      'referências complementares precisam de conferência humana',
    );
    expect(prompt).toContain('Use objetos simples da sala.');
    expect(prompt).not.toContain('gere exatamente dez perguntas');
  });

  it('prioriza memorização infantil e exige propósito, narrativa e aplicação concretos', async () => {
    const prompt = await service.effective('admin-a', LessonStageType.LESSON);
    expect(prompt).toContain('Prefira até 20 palavras');
    expect(prompt).toContain('frase de 3 a 12 palavras');
    expect(prompt).toContain('reescreva os trechos');
    expect(prompt).toContain(
      'a sigla NVI pertence exclusivamente ao campo version',
    );
    expect(prompt).toContain(
      'Não atribua ao versículo palavras, títulos ou imagens que ele não contém',
    );
    expect(prompt).toContain('ao menos dois exemplos concretos de pecado');
    expect(prompt).toContain(
      'Pode escolher um versículo diferente do exemplo histórico',
    );
    expect(prompt).toContain(
      'Respeite um versículo explicitamente solicitado pelo administrador',
    );
    expect(prompt).toContain('não corte de modo a alterar o sentido');
    expect(prompt).toContain('uma única frase curta');
    expect(prompt).toContain('nem restringir o público');
    expect(prompt).toContain(
      'sentimentos, intenções e diálogos sustentados pelas referências',
    );
    expect(prompt).toContain('Ilustrações fictícias do cotidiano');
    expect(prompt).toContain('Para quem já crê em Jesus');
    expect(prompt).toContain('Para quem deseja seguir Jesus');
    expect(prompt).toContain('mentir, desobedecer ou machucar alguém');
    expect(prompt).toContain('morte e ressurreição de Jesus');
    expect(prompt).toContain(
      'A explicação do princípio e as perguntas devem usar exatamente o texto escolhido',
    );
    expect(prompt).not.toContain(
      'não amplie o texto nem troque por outro versículo',
    );
  });

  it('aplica regras de integridade e fidelidade a qualquer tema', async () => {
    const prompt = await service.effective('admin-a', LessonStageType.LESSON);
    expect(prompt).toContain('REGRAS GERAIS PARA QUALQUER TEMA');
    expect(prompt).toContain('nunca omita o desfecho');
    expect(prompt).toContain(
      'Não transfira automaticamente para todos os personagens',
    );
    expect(prompt).toContain('sem detalhes de ferimentos');
    expect(prompt).toContain('Se você deseja, pode orar comigo');
    expect(prompt).toContain('Não cobre uma fala ou um desfecho ausente');
  });

  it('rejeita atualização concorrente e restaura o padrão', async () => {
    const saved = await service.save(
      'admin-a',
      LessonStageType.STANDARD_GAME,
      'Prompt personalizado suficientemente longo.',
    );
    await expect(
      service.save(
        'admin-a',
        LessonStageType.STANDARD_GAME,
        'Outra versão suficientemente longa.',
        (saved.lockVersion ?? 1) - 1,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    // A reset without the version the editor loaded would be a blind overwrite.
    await expect(
      service.reset('admin-a', LessonStageType.STANDARD_GAME),
    ).rejects.toBeInstanceOf(ConflictException);
    const reset = await service.reset(
      'admin-a',
      LessonStageType.STANDARD_GAME,
      saved.lockVersion ?? undefined,
    );
    expect(reset.customPrompt).toBeNull();
    // The row survives with a monotonic version, so a stale editor cannot win.
    expect(reset.lockVersion).toBe((saved.lockVersion ?? 0) + 1);
    await expect(
      service.save(
        'admin-a',
        LessonStageType.STANDARD_GAME,
        'Texto de uma sessão antiga, suficientemente longo.',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.save(
        'admin-a',
        LessonStageType.STANDARD_GAME,
        'Texto de uma sessão antiga, suficientemente longo.',
        saved.lockVersion ?? undefined,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(
      (
        await service.save(
          'admin-a',
          LessonStageType.STANDARD_GAME,
          'Texto da sessão atual, suficientemente longo.',
          reset.lockVersion ?? undefined,
        )
      ).customPrompt,
    ).toBe('Texto da sessão atual, suficientemente longo.');
    expect(reset.effectivePrompt).toBe(reset.basePrompt);
    expect(reset.basePrompt).toContain('pedindo "de novo!"');
    expect(reset.basePrompt).toContain('5 a 7 anos');
    expect(reset.basePrompt).toContain('8 a 11 anos');
    expect(reset.basePrompt).toContain('ninguém fica parado assistindo');
    expect(reset.basePrompt).toContain('estoura balão');
  });

  it('trata como conflito a gravação condicional que não alterou nenhuma linha', async () => {
    const saved = await service.save(
      'admin-a',
      LessonStageType.LESSON,
      'Prompt personalizado suficientemente longo.',
    );
    // Another instance won the race between this read and its UPDATE.
    repository.updatePromptWhereVersion.mockResolvedValueOnce(false);
    await expect(
      service.save(
        'admin-a',
        LessonStageType.LESSON,
        'Outra versão suficientemente longa.',
        saved.lockVersion ?? undefined,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    repository.updatePromptWhereVersion.mockResolvedValueOnce(false);
    await expect(
      service.reset(
        'admin-a',
        LessonStageType.LESSON,
        saved.lockVersion ?? undefined,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('descreve o kit de recortes nos visuais da história, sem o contrato antigo de cenas', async () => {
    const prompt = await service.effective(
      'admin-a',
      LessonStageType.LESSON_VISUALS,
    );
    expect(prompt).toContain('KIT DE RECORTES');
    expect(prompt).toContain('kit-01');
    expect(prompt).toContain('storyEvidence');
    expect(prompt).not.toContain('sceneId');
    expect(prompt).not.toContain('STORY_SEQUENCE');
    expect(prompt).not.toContain(
      'Cada imagem deve representar um acontecimento',
    );
  });

  it('converte a criação concorrente (ER_DUP_ENTRY) em conflito 409', async () => {
    repository.savePrompt.mockRejectedValueOnce(
      Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' }),
    );
    await expect(
      service.save(
        'admin-a',
        LessonStageType.MANUAL_WORK,
        'Prompt personalizado suficientemente longo.',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    repository.savePrompt.mockRejectedValueOnce(new Error('Database down'));
    await expect(
      service.save(
        'admin-a',
        LessonStageType.MANUAL_WORK,
        'Prompt personalizado suficientemente longo.',
      ),
    ).rejects.toThrow('Database down');
  });

  it('dois salvamentos seguidos guardam só o complemento e a base aparece uma única vez', async () => {
    const first = await service.save(
      'admin-a',
      LessonStageType.MANUAL_WORK,
      'Primeiro complemento suficientemente longo.',
    );
    const second = await service.save(
      'admin-a',
      LessonStageType.MANUAL_WORK,
      'Segundo complemento suficientemente longo.',
      first.lockVersion ?? undefined,
    );
    expect(second.customPrompt).toBe(
      'Segundo complemento suficientemente longo.',
    );
    expect(second.effectivePrompt.split(second.basePrompt)).toHaveLength(2);
    expect(second.effectivePrompt).not.toContain('Primeiro complemento');
    expect(second.effectivePrompt).toContain(
      'ORIENTAÇÃO COMPLEMENTAR DO ADMINISTRADOR',
    );
  });
});
