import { LESSON_SHARED_QUALITY_RULES } from '../constants/lesson-quality.constants';
import { createHash } from 'node:crypto';
import { LessonStageType } from '../enums/lesson.enums';
import {
  LESSON_FUN_GAME_LIMITS,
  LESSON_GAME_MAX_STEPS,
} from '../constants/ai-provider-settings.constants';

export type LessonTemplateContract = {
  key: string;
  version: string;
  stage: LessonStageType;
  exactStructure: readonly string[];
  rules: readonly string[];
};

/** Each step becomes one generated image: the ceiling keeps cost bounded. */
const GAME_STEP_LIMIT_RULE = `Descrever a brincadeira em no máximo ${LESSON_GAME_MAX_STEPS} passos objetivos; cada passo recebe exatamente um visual.`;

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
      version: '4.10.1',
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
        'A história é uma aula desenvolvida e participativa, com 900 a 1.400 palavras, pelo menos quatro parágrafos por relato, instruções práticas ao professor, ensino integrado e episódios essenciais completos; não é um resumo. Descrições visuais ficam somente em visualScenes, com IDs estáveis scene-01 etc., nunca dentro de story.',
        'Quando o tema ou a orientação indicar duas ou mais sub-histórias, informar a quantidade na abertura, desenvolver cada relato separadamente e inserir subtítulos em linhas próprias no campo story com o prefixo ### e a referência correspondente. Passagens paralelas não representam histórias distintas.',
        'Escrever um propósito curto, claro e específico para a criança, ligado ao tema. Escolher um versículo NVI (ou dois consecutivos, somente se um só não completar o ensino) que resuma a mensagem central da lição inteira, curto para memorizar (preferencialmente até 20 palavras, nunca muito acima de 30); a seleção histórica é sugestiva, salvo solicitação explícita do administrador. Preservar a ordem dos episódios sem copiar erros do exemplo.',
        'A narrativa não pode apresentar sentimentos, intenções ou diálogos não sustentados pelas passagens como fatos bíblicos. Separar ilustrações fictícias e reconto de citações literais pela forma de narrar, sem notas explicativas no texto.',
        'Aplicação em parágrafos distintos para quem já crê e para quem deseja seguir Jesus: atitudes concretas ligadas ao propósito, explicação simples de pecado com exemplos infantis, morte e ressurreição de Jesus, convite e oração voluntários.',
        'Revisar e corrigir a saída antes de entregar: preferir frase bíblica curta sem introdução narrativa, não duplicar NVI na referência, não atribuir títulos ausentes ao versículo, retirar especulações e incluir pelo menos dois exemplos infantis concretos de pecado na aplicação.',
        'Definir primeiro a mensagem central da lição (centralMessage, campo interno) e escolher o versículo que a resume (verseChoice, campo interno); propósito, princípio, conclusão da história, aplicação e última pergunta servem a essa mesma mensagem. A história termina com o ensino que Jesus ou a passagem quis transmitir.',
        'Regras gerais para qualquer tema: concluir cada relato antes da aplicação, harmonizar evangelhos numa narrativa única sem transferir detalhes de um personagem a outro nem citar evangelistas no texto, reduzir descrições assustadoras, manter convite voluntário e verificar que perguntas e respostas têm apoio no conteúdo ensinado.',
        'Gerar de oito a dez perguntas com gabarito, respeitando a quantidade do exemplo correspondente. closingPrayer fica vazio salvo solicitação explícita de oração final separada.',
        'A oração de apelo deve ser revisável e nunca pode ser substituída por texto dentro de imagem.',
      ],
    },
    [LessonStageType.LESSON_VISUALS]: {
      key: 'clubinho.lesson-visuals.canonical',
      version: '3.0.1',
      stage: LessonStageType.LESSON_VISUALS,
      exactStructure: [
        'INVENTÁRIO DE ELEMENTOS DA LIÇÃO',
        'PRANCHAS POR CATEGORIA',
        'VARIANTES',
        'PERSONAGENS E CONSISTÊNCIA',
        'TEXTO ALTERNATIVO',
      ],
      rules: [
        ...sharedRules,
        'Estes são exclusivamente visuais de apoio para o professor contar a história; não são visuais de memorização do versículo.',
        'O produto é um kit de recortes: pranchas de elementos isolados em fundo branco, que o professor recorta e monta. Não gere cenas completas.',
        'Faça o inventário completo da LIÇÃO BÍBLICA: todo personagem, animal, construção, cenário e objeto relevante precisa existir no kit, cada um com storyEvidence literal.',
        'Cada prancha usa id sequencial kit-01, kit-02 e assim por diante, com categoria, itens, layoutPlan, prompt e altText.',
        'Elementos que mudam de estado ou pose na história têm uma variante cada. Legendas são aplicadas depois pelo sistema; a imagem não contém texto.',
        'Estilo de ilustração bíblica infantil, amigável, com cores claras, sem violência gráfica e sem texto na imagem.',
      ],
    },
    [LessonStageType.STANDARD_GAME]: {
      key: 'clubinho.standard-game.canonical',
      version: '4.2.0',
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
        'A brincadeira divertida é recreação de verdade, no estilo gincana: mecânica física e de ação (correr, pular, mirar, arremessar, equilibrar, puxar, estourar, buscar), inspirada em clássicos como estoura balão, pescaria, tiro ao alvo, cabo de guerra, pênalti, corrida do saco, ovo na colher e boliche de garrafa.',
        'Equipes, rodadas, placar e vencedor são bem-vindos; todos comemoram no fim. A ligação com a lição é leve: nome, tema e o princípio bíblico depois de brincar.',
        'Proibido como mecânica principal: desenhar, gestos ou mímica parados, apontar cartazes, quiz, reflexão, encenação ou atividade de mesa.',
        'A brincadeira deve ser segura e exequível; a regra central serve de 5 a 11 anos, com simplificação para 5 a 7 e desafio extra para 8 a 11 anos.',
        'A entrega é um documento simples explicando a brincadeira e UMA única imagem (id compilado-01) com o compilado de tudo: materiais, preparação do espaço, o passo a passo em painéis na ordem de leitura e o encerramento. A imagem mostra crianças genéricas e alegres fazendo cada ação, em clima de gincana; não criar uma imagem por passo nem personagens ou cenas bíblicas.',
        `Documento curto, de uma página A4: de 3 a ${LESSON_FUN_GAME_LIMITS.maxSteps} passos de uma frase, até ${LESSON_FUN_GAME_LIMITS.maxMaterials} materiais, até ${LESSON_FUN_GAME_LIMITS.maxRules} regras curtas, uma frase por adaptação e por objetivo. Sem repetir informação entre seções.`,
        'Exceção à regra de textos do renderer: o compilado-01 traz o título, as faixas, os passos numerados e o encerramento escritos na própria arte.',
      ],
    },
    [LessonStageType.VERSE_VISUALS]: {
      key: 'clubinho.verse-visuals.canonical',
      version: '1.4.1',
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
        'Cartões tipográficos finais em A4 paisagem, sem borda branca: a própria imagem gerada contém o texto exato, extragrande e arredondado em aproximadamente 90% da área, e só as sobras recebem detalhes minúsculos e variados ligados ao sentido do trecho, em quantidade decidida pelo espaço livre, pelo estilo e pela semântica, somando no máximo 10% da imagem, sem nunca diminuir o texto; fundo e paleta única de no máximo três cores escolhidos a partir do versículo e mantidos em toda a sequência.',
      ],
    },
    [LessonStageType.VERSE_FIXATION]: {
      key: 'clubinho.verse-fixation.canonical',
      version: '2.2.0',
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
        GAME_STEP_LIMIT_RULE,
      ],
    },
    [LessonStageType.MEDITATION_YOUNGER]: {
      key: 'clubinho.meditation-younger.canonical',
      version: '1.3.0',
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
        'Criar exatamente duas atividades complementares para 4 a 7 anos: priorizar labirinto/percurso/associação e reconhecimento com alternativas, pistas ou pintura seletiva. Desenho livre para colorir é excepcional, nunca o padrão nem as duas atividades.',
        'Usar o único versículo principal NVI aprovado, sem paráfrase.',
        'Gerar de uma a duas artes funcionais, ids 1 e 2 associados às atividades. Incluir caminhos, alternativas, letras e rótulos indispensáveis à solução; não gerar arte decorativa para questões textuais. Conferir a solução e todas as pistas.',
        'A composição final deve permitir duas cópias idênticas da meditação por folha A4, como no padrão manual.',
      ],
    },
    [LessonStageType.MEDITATION_OLDER]: {
      key: 'clubinho.meditation-older.canonical',
      version: '2.0.1',
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
        'Três blocos estruturados: narrativa, compreensão e aplicação concreta, com mecânicas distintas. Subitens e gabaritos completos; sem mínimo artificial de palavras. Sempre três imagens, uma como anexo ou apoio de cada questão, sem repetir texto ou revelar respostas.',
        'Cada desafio precisa ter instrução completa e gabarito determinístico para o professor.',
        'Usar o único versículo principal NVI aprovado, sem paráfrase.',
        'Gerar exatamente três imagens de anexo ou apoio às questões, ids 1, 2 e 3. Permitir letras/números e legendas curtas quando indispensáveis; omitir cabeçalho, instruções e gabarito na imagem.',
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
        'Criar uma única imagem para a criança pintar, diretamente relacionada à lição e ao único versículo principal NVI aprovado. Nunca entregar desenho já colorido.',
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

/**
 * Story visuals of a weekly lesson as complete scenes (the alternative to the
 * cutout kit): one full illustration per literal excerpt of the story.
 */
export const REGULAR_SCENE_VISUALS_TEMPLATE: LessonTemplateContract = {
  key: 'clubinho.lesson-visuals.scenes',
  version: '1.0.0',
  stage: LessonStageType.LESSON_VISUALS,
  exactStructure: [
    'CENAS COMPLETAS DA HISTÓRIA, NA ORDEM',
    'TRECHO LITERAL DE CADA CENA',
    'PERSONAGENS E CONSISTÊNCIA',
    'TEXTO ALTERNATIVO',
  ],
  rules: [
    ...sharedRules,
    'Estes são exclusivamente visuais de apoio para o professor contar a história; não são visuais de memorização do versículo.',
    'O produto são cenas completas: cada imagem ilustra um trecho da LIÇÃO BÍBLICA com ambiente, personagens e a ação principal, em enquadramento claro para o professor mostrar à distância. Não gere pranchas de recorte.',
    'Divida toda a LIÇÃO BÍBLICA em exatamente visualConfig.quantity trechos literais, contínuos, consecutivos e sem sobreposição; cada asset (visual-01, visual-02 e assim por diante) traz em sourceExcerpt o seu trecho exato.',
    'Ilustre somente o que o trecho narra. Orientações ao professor entre parênteses e perguntas às crianças não são cena.',
    'Personagens mantêm o mesmo rosto, roupa e traço em todas as cenas; a primeira cena estabelece a identidade visual.',
    'Sem texto, legenda, balão ou número dentro da imagem; nada violento, assustador ou sexualizado.',
  ],
};
