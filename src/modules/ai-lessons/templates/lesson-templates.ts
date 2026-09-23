import { createHash } from 'node:crypto';
import { LessonStageType } from '../enums/lesson.enums';

export type LessonTemplateContract = {
  key: string;
  version: string;
  stage: LessonStageType;
  exactStructure: readonly string[];
  rules: readonly string[];
};

const sharedRules = [
  'Escrever em português brasileiro, para crianças, com fidelidade bíblica e linguagem acolhedora.',
  'Usar a Bíblia NVI como referência e adequar todo o conteúdo a crianças de 5 a 11 anos.',
  'Não incluir conteúdo sexual, romântico, erotizado ou debates de sexualidade; manter foco exclusivo na passagem bíblica.',
  'Não inventar citações bíblicas. A referência e o texto devem ser coerentes entre si.',
  'Não alterar, omitir, renomear ou reordenar os campos do template.',
  'Não inserir logos, títulos ou palavras dentro da arte gerada; textos são compostos pelo renderer.',
] as const;

export const LESSON_TEMPLATES: Record<LessonStageType, LessonTemplateContract> = {
  [LessonStageType.LESSON]: {
    key: 'clubinho.lesson.canonical', version: '1.0.0', stage: LessonStageType.LESSON,
    exactStructure: ['LIÇÃO E TÍTULO', 'TEXTO/REFERÊNCIA BÍBLICA', 'PROPÓSITO', 'MÚSICAS', 'VERSÍCULO PARA MEMORIZAR', 'EXPLICAÇÃO DO PRINCÍPIO', 'HISTÓRIA BÍBLICA', 'APLICAÇÃO E APELO', 'CANTINHO DO ACONSELHAMENTO', '10 PERGUNTAS DA LIÇÃO COM GABARITO', 'FALANDO COM DEUS'],
    rules: [...sharedRules, 'A história deve indicar cenas visuais por IDs estáveis scene-01, scene-02 etc., sem marcadores textuais [Image #].', 'A oração de apelo deve ser revisável e nunca pode ser substituída por texto dentro de imagem.'],
  },
  [LessonStageType.LESSON_VISUALS]: {
    key: 'clubinho.lesson-visuals.canonical', version: '1.0.0', stage: LessonStageType.LESSON_VISUALS,
    exactStructure: ['CENAS EM ORDEM DA NARRATIVA', 'DESCRIÇÃO VISUAL', 'PERSONAGENS E CONSISTÊNCIA', 'MOMENTO DA LIÇÃO', 'TEXTO ALTERNATIVO'],
    rules: [...sharedRules, 'Estes são exclusivamente visuais narrativos para o professor contar a história; não são visuais de memorização do versículo.', 'Cada visual deve corresponder a um sceneId aprovado na lição.', 'Estilo de ilustração bíblica infantil, amigável, com cores claras, sem violência gráfica e sem texto na imagem.', 'Toda imagem deve ser horizontal, modo paisagem, com composição segura para impressão em A4 paisagem.'],
  },
  [LessonStageType.STANDARD_GAME]: {
    key: 'clubinho.standard-game.canonical', version: '1.0.0', stage: LessonStageType.STANDARD_GAME,
    exactStructure: ['NOME DA BRINCADEIRA', 'OBJETIVO', 'MATERIAIS', 'PREPARAÇÃO', 'COMO BRINCAR/PASSO A PASSO', 'REGRAS E SEGURANÇA', 'PRINCÍPIO BÍBLICO', 'VISUAIS DE APOIO'],
    rules: [...sharedRules, 'A brincadeira deve ser segura, exequível e adequada ao espaço infantil.', 'Visuais de apoio não podem conter texto; rótulos são compostos no documento.'],
  },
  [LessonStageType.VERSE_VISUALS]: {
    key: 'clubinho.verse-visuals.canonical', version: '1.0.0', stage: LessonStageType.VERSE_VISUALS,
    exactStructure: ['VISUAIS DO VERSÍCULO', 'VERSÍCULO PRINCIPAL NVI', 'JUSTIFICATIVA DA QUEBRA SEMÂNTICA', 'SEQUÊNCIA DE TRECHOS', 'CARTÃO FINAL DA REFERÊNCIA'],
    rules: [...sharedRules, 'Usar exatamente o único versículo principal NVI aprovado na lição.', 'Dividir todo o texto do versículo em trechos curtos, consecutivos e semanticamente completos, sem omitir, repetir, alterar ou reordenar palavras.', 'Criar uma imagem mnemônica para cada trecho e acrescentar obrigatoriamente uma última imagem dedicada somente à referência bíblica.', 'A quantidade é determinada pela melhor quebra pedagógica do versículo; o cartão final não contém o texto do versículo.', 'Imagens em cores claras, A4 paisagem, sem texto embutido; o renderer compõe trechos e referência com exatidão.'],
  },
  [LessonStageType.VERSE_FIXATION]: {
    key: 'clubinho.verse-fixation.canonical', version: '2.0.0', stage: LessonStageType.VERSE_FIXATION,
    exactStructure: ['SUGESTÃO DE FIXAÇÃO DO VERSÍCULO', 'OBJETIVO', 'MATERIAIS', 'PREPARAÇÃO', 'PASSO A PASSO', 'COMO AVALIAR', 'PRINCÍPIO BÍBLICO', 'PEÇAS IMPRIMÍVEIS'],
    rules: [...sharedRules, 'Usar exatamente o único versículo principal NVI aprovado na lição.', 'Criar uma dinâmica ou brincadeira divertida de memorização, distinta dos cartões semânticos da etapa Visuais do Versículo.', 'Descrever duração, preparação, passos, adaptações por idade, segurança e avaliação sem constrangimento.', 'Peças imprimíveis são opcionais e só existem quando necessárias para executar a dinâmica.'],
  },
  [LessonStageType.MEDITATION_YOUNGER]: {
    key: 'clubinho.meditation-younger.canonical', version: '1.0.0', stage: LessonStageType.MEDITATION_YOUNGER,
    exactStructure: ['MEDITAÇÃO PARA CRIANÇAS MENORES', 'TÍTULO', 'NOME E DATA', 'VERSÍCULO PARA DECORAR', 'ATIVIDADES', 'FALANDO COM DEUS', 'PEÇAS IMPRIMÍVEIS'],
    rules: [...sharedRules, 'Criar exatamente duas atividades simples e predominantemente visuais para crianças de 5 a 7 anos.', 'Usar o único versículo principal NVI aprovado, sem paráfrase.', 'Gerar ilustrações em line art preto e branco, com contornos grossos, áreas amplas e sem texto, adequadas para colorir em A4 retrato.', 'A composição final deve permitir duas cópias idênticas da meditação por folha A4, como no padrão manual.'],
  },
  [LessonStageType.MEDITATION_OLDER]: {
    key: 'clubinho.meditation-older.canonical', version: '1.0.0', stage: LessonStageType.MEDITATION_OLDER,
    exactStructure: ['MEDITAÇÃO PARA CRIANÇAS MAIORES', 'TÍTULO', 'NOME E DATA', 'VERSÍCULO PARA DECORAR', 'TEXTO BÍBLICO', 'ENTENDENDO A LIÇÃO', 'TRÊS DESAFIOS', 'GABARITO', 'FALANDO COM DEUS', 'PEÇAS IMPRIMÍVEIS'],
    rules: [...sharedRules, 'Criar exatamente três desafios variados para crianças de 8 a 11 anos, incluindo compreensão bíblica e atividades como código, sequência, labirinto, associação ou encontre diferenças.', 'Cada desafio precisa ter instrução completa e gabarito determinístico para o professor.', 'Usar o único versículo principal NVI aprovado, sem paráfrase.', 'Gerar somente as ilustrações necessárias em line art preto e branco, sem texto dentro da imagem, para composição em uma folha A4 retrato.'],
  },
  [LessonStageType.MANUAL_WORK]: {
    key: 'clubinho.manual-work.canonical', version: '1.0.0', stage: LessonStageType.MANUAL_WORK,
    exactStructure: ['TRABALHO MANUAL', 'VERSÍCULO PRINCIPAL', 'INSTRUÇÃO', 'DESENHO PARA COLORIR', 'PADRÃO DE IMPRESSÃO'],
    rules: [...sharedRules, 'Criar um desenho diretamente relacionado à lição e ao único versículo principal NVI aprovado.', 'A arte deve ser line art preto e branco puro, fundo branco, contornos nítidos e grossos, sem cinza, cor, sombra, textura fotográfica ou áreas excessivamente fechadas.', 'Não inserir letras ou versículo na imagem; o renderer aplica texto e referência com fidelidade.', 'Preparar duas cópias idênticas do trabalho manual em uma folha A4 retrato, com margens seguras para impressão e recorte.'],
  },
};

export function serializeTemplate(contract: LessonTemplateContract): string {
  return JSON.stringify(contract);
}

export function templateChecksum(contract: LessonTemplateContract): string {
  return createHash('sha256').update(serializeTemplate(contract)).digest('hex');
}
