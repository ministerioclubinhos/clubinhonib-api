import { LESSON_SHARED_QUALITY_RULES } from '../constants/lesson-quality.constants';
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
  ...LESSON_SHARED_QUALITY_RULES,
  'Escrever em português brasileiro, para crianças, com fidelidade bíblica e linguagem acolhedora.',
  'Usar a Bíblia NVI como referência e adequar todo o conteúdo a crianças de 5 a 11 anos.',
  'Não incluir conteúdo sexual, romântico, erotizado ou debates de sexualidade; manter foco exclusivo na passagem bíblica.',
  'Não inventar citações bíblicas. A referência e o texto devem ser coerentes entre si.',
  'Não alterar, omitir, renomear ou reordenar os campos do template.',
  'Não inserir logos na arte. Textos são compostos pelo renderer, exceto nos cartões tipográficos de VERSE_VISUALS, cuja própria imagem deve conter o texto exato exigido pelo contrato.',
] as const;

export const LESSON_TEMPLATES: Record<LessonStageType, LessonTemplateContract> =
  {
    [LessonStageType.LESSON]: {
      key: 'clubinho.lesson.canonical',
      version: '4.5.0',
      stage: LessonStageType.LESSON,
      exactStructure: [
        'LIÇÃO E TÍTULO',
        'TEXTO/REFERÊNCIA BÍBLICA',
        'PROPÓSITO',
        'MÚSICAS',
        'VERSÍCULO PARA MEMORIZAR',
        'EXPLICAÇÃO DO PRINCÍPIO',
        'HISTÓRIA BÍBLICA',
        'APLICAÇÃO E APELO',
        'CANTINHO DO ACONSELHAMENTO',
        '8 A 10 PERGUNTAS DA LIÇÃO COM GABARITO',
        'FALANDO COM DEUS (SOMENTE QUANDO SOLICITADO)',
      ],
      rules: [
        ...sharedRules,
        'A história é uma aula desenvolvida e participativa, com instruções práticas ao professor, ensino integrado e episódios essenciais completos; não é um resumo. Descrições visuais ficam somente em visualScenes, com IDs estáveis scene-01 etc., nunca dentro de story.',
        'Quando o tema ou a orientação indicar duas ou mais sub-histórias, informar a quantidade na abertura, desenvolver cada relato separadamente e inserir subtítulos em linhas próprias no campo story com o prefixo ### e a referência correspondente. Passagens paralelas não representam histórias distintas.',
        'Escrever um propósito curto, claro e específico para a criança, ligado ao tema. Escolher um versículo ou trecho NVI curto, preferencialmente até 20 palavras, fácil de memorizar e diretamente contextualizado; a seleção histórica é sugestiva, salvo solicitação explícita do administrador. Preservar a ordem dos episódios sem copiar erros do exemplo.',
        'A narrativa não pode apresentar sentimentos, intenções ou diálogos não sustentados pelas passagens como fatos bíblicos. Separar ilustrações fictícias e reconto de citações literais.',
        'Aplicação em parágrafos distintos para quem já crê e para quem deseja seguir Jesus: atitudes concretas ligadas ao propósito, explicação simples de pecado com exemplos infantis, morte e ressurreição de Jesus, convite e oração voluntários.',
        'Revisar e corrigir a saída antes de entregar: preferir frase bíblica curta sem introdução narrativa, não duplicar NVI na referência, não atribuir títulos ausentes ao versículo, retirar especulações e incluir pelo menos dois exemplos infantis concretos de pecado na aplicação.',
        'Regras gerais para qualquer tema: concluir cada relato antes da aplicação, preservar atribuições individuais ao harmonizar evangelhos, reduzir descrições assustadoras, manter convite voluntário e verificar que perguntas e respostas têm apoio no conteúdo ensinado.',
        'Gerar de oito a dez perguntas com gabarito, respeitando a quantidade do exemplo correspondente. closingPrayer fica vazio salvo solicitação explícita de oração final separada.',
        'A oração de apelo deve ser revisável e nunca pode ser substituída por texto dentro de imagem.',
      ],
    },
    [LessonStageType.LESSON_VISUALS]: {
      key: 'clubinho.lesson-visuals.canonical',
      version: '2.1.0',
      stage: LessonStageType.LESSON_VISUALS,
      exactStructure: [
        'QUEBRA INTEGRAL DA LIÇÃO BÍBLICA',
        'TRECHOS EM ORDEM DA NARRATIVA',
        'DESCRIÇÃO VISUAL',
        'PERSONAGENS E CONSISTÊNCIA',
        'TEXTO ALTERNATIVO',
      ],
      rules: [
        ...sharedRules,
        'Estes são exclusivamente visuais narrativos para o professor contar a história; não são visuais de memorização do versículo.',
        'A IA deve dividir todo o texto da LIÇÃO BÍBLICA em exatamente a quantidade solicitada, usando trechos literais, contínuos, consecutivos, sem sobreposição, omissão ou repetição.',
        'Cada visual usa id sequencial visual-01, visual-02 e assim por diante e preserva a ordem da narrativa.',
        'Estilo de ilustração bíblica infantil, amigável, com cores claras, sem violência gráfica e sem texto na imagem.',
      ],
    },
    [LessonStageType.STANDARD_GAME]: {
      key: 'clubinho.standard-game.canonical',
      version: '3.1.0',
      stage: LessonStageType.STANDARD_GAME,
      exactStructure: [
        'NOME DA BRINCADEIRA',
        'OBJETIVO',
        'MECÂNICAS DIVERTIDAS',
        'MATERIAIS',
        'PREPARAÇÃO',
        'COMO BRINCAR/PASSO A PASSO',
        'REGRAS E SEGURANÇA',
        'ADAPTAÇÕES PARA 5–7 E 8–11 ANOS',
        'PRINCÍPIO BÍBLICO',
        'VISUAIS DE APOIO',
      ],
      rules: [
        ...sharedRules,
        'A brincadeira deve ser segura, exequível e adequada ao espaço infantil.',
        'A dinâmica deve combinar 2 ou 3 elementos lúdicos, manter todas as crianças ativas e evitar filas, eliminação, espera longa, questionário ou encenação passiva.',
        'A regra central deve servir de 5 a 11 anos, com simplificação para 5 a 7 e desafio opcional para 8 a 11 anos.',
        'Criar exatamente um visual instrucional para cada passo da brincadeira, na mesma ordem, demonstrando como executar a instrução em vez de gerar decoração genérica.',
        'Visuais de apoio não podem conter texto; as instruções são exibidas como legenda e compostas pelo renderer.',
      ],
    },
    [LessonStageType.VERSE_VISUALS]: {
      key: 'clubinho.verse-visuals.canonical',
      version: '1.1.0',
      stage: LessonStageType.VERSE_VISUALS,
      exactStructure: [
        'VISUAIS DO VERSÍCULO',
        'VERSÍCULO PRINCIPAL NVI',
        'JUSTIFICATIVA DA QUEBRA SEMÂNTICA',
        'SEQUÊNCIA DE TRECHOS',
        'CARTÃO FINAL DA REFERÊNCIA',
      ],
      rules: [
        ...sharedRules,
        'Usar exatamente o único versículo principal NVI aprovado na lição.',
        'Dividir todo o texto do versículo em trechos curtos, consecutivos e semanticamente completos, sem omitir, repetir, alterar ou reordenar palavras.',
        'Criar uma imagem mnemônica para cada trecho e acrescentar obrigatoriamente uma última imagem dedicada somente à referência bíblica.',
        'A quantidade é determinada pela melhor quebra pedagógica do versículo; o cartão final não contém o texto do versículo.',
        'Cartões tipográficos finais em A4 paisagem no padrão da Semana 7: a própria imagem gerada contém o texto exato, extragrande e arredondado em aproximadamente 95% da área, sem sobreposição posterior, usando uma paleta única de no máximo três cores em toda a sequência.',
      ],
    },
    [LessonStageType.VERSE_FIXATION]: {
      key: 'clubinho.verse-fixation.canonical',
      version: '2.1.0',
      stage: LessonStageType.VERSE_FIXATION,
      exactStructure: [
        'NOME DA BRINCADEIRA',
        'OBJETIVO',
        'MECÂNICAS DIVERTIDAS',
        'MATERIAIS',
        'PREPARAÇÃO',
        'COMO BRINCAR/PASSO A PASSO',
        'REGRAS E SEGURANÇA',
        'ADAPTAÇÕES PARA 5–7 E 8–11 ANOS',
        'COMO AVALIAR',
        'PRINCÍPIO BÍBLICO',
        'VISUAIS DE APOIO',
      ],
      rules: [
        ...sharedRules,
        'Usar exatamente o único versículo principal NVI aprovado na lição.',
        'Usar o mesmo template completo da Brincadeira Normal, mas fazer da compreensão e memorização do versículo o objetivo central de todas as mecânicas.',
        'Combinar 2 ou 3 mecânicas lúdicas, manter todas as crianças ativas e concluir com a recitação coletiva do versículo completo.',
        'Criar exatamente um visual instrucional para cada passo, na mesma ordem, demonstrando como executar a instrução e sem texto dentro da imagem.',
      ],
    },
    [LessonStageType.MEDITATION_YOUNGER]: {
      key: 'clubinho.meditation-younger.canonical',
      version: '1.1.0',
      stage: LessonStageType.MEDITATION_YOUNGER,
      exactStructure: [
        'MEDITAÇÃO PARA CRIANÇAS MENORES',
        'TÍTULO',
        'NOME E DATA',
        'VERSÍCULO PARA DECORAR',
        'ATIVIDADES',
        'FALANDO COM DEUS',
        'PEÇAS IMPRIMÍVEIS',
      ],
      rules: [
        ...sharedRules,
        'Criar exatamente duas atividades simples e exatamente duas imagens correspondentes, na mesma ordem, para crianças de 5 a 7 anos.',
        'Usar o único versículo principal NVI aprovado, sem paráfrase.',
        'Gerar ilustrações em line art preto e branco, com contornos grossos, áreas amplas e sem texto, adequadas para colorir em A4 retrato.',
        'A composição final deve permitir duas cópias idênticas da meditação por folha A4, como no padrão manual.',
      ],
    },
    [LessonStageType.MEDITATION_OLDER]: {
      key: 'clubinho.meditation-older.canonical',
      version: '1.1.0',
      stage: LessonStageType.MEDITATION_OLDER,
      exactStructure: [
        'MEDITAÇÃO PARA CRIANÇAS MAIORES',
        'TÍTULO',
        'NOME E DATA',
        'VERSÍCULO PARA DECORAR',
        'TEXTO BÍBLICO',
        'ENTENDENDO A LIÇÃO',
        'TRÊS DESAFIOS',
        'GABARITO',
        'FALANDO COM DEUS',
        'PEÇAS IMPRIMÍVEIS',
      ],
      rules: [
        ...sharedRules,
        'Criar exatamente três desafios variados e exatamente três imagens correspondentes, na mesma ordem, para crianças de 8 a 11 anos.',
        'Cada desafio precisa ter instrução completa e gabarito determinístico para o professor.',
        'Usar o único versículo principal NVI aprovado, sem paráfrase.',
        'Gerar somente as ilustrações necessárias em line art preto e branco, sem texto dentro da imagem, para composição em uma folha A4 retrato.',
      ],
    },
    [LessonStageType.MANUAL_WORK]: {
      key: 'clubinho.manual-work.canonical',
      version: '1.1.0',
      stage: LessonStageType.MANUAL_WORK,
      exactStructure: [
        'TRABALHO MANUAL',
        'VERSÍCULO PRINCIPAL',
        'INSTRUÇÃO',
        'DESENHO PARA COLORIR',
        'PADRÃO DE IMPRESSÃO',
      ],
      rules: [
        ...sharedRules,
        'Criar um desenho diretamente relacionado à lição e ao único versículo principal NVI aprovado.',
        'A arte deve ser line art preto e branco puro, fundo branco, contornos nítidos e grossos, sem cinza, cor, sombra, textura fotográfica ou áreas excessivamente fechadas.',
        'Não inserir letras ou versículo na imagem; o renderer aplica texto e referência com fidelidade.',
        'Preparar duas cópias idênticas do trabalho manual em uma folha A4 retrato, com margens seguras para impressão e recorte.',
      ],
    },
  };

export function serializeTemplate(contract: LessonTemplateContract): string {
  return JSON.stringify(contract);
}

export function templateChecksum(contract: LessonTemplateContract): string {
  return createHash('sha256').update(serializeTemplate(contract)).digest('hex');
}
