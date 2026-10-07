import { LessonStageType } from '../enums/lesson.enums';

export const LESSON_SHARED_QUALITY_RULES = [
  'Use a lição aprovada como fonte das etapas derivadas: tema, propósito, personagens, acontecimentos e aplicação devem permanecer coerentes, sem acrescentar fatos bíblicos não conferidos.',
  'Não invente falas, sentimentos, intenções, referências ou páginas de manuais. Ao combinar relatos bíblicos, identifique os detalhes de cada relato sem transferi-los automaticamente para todos os personagens.',
  'Na lição, escolha um versículo curto e contextualizado para memorização infantil. Nas etapas derivadas, preserve exatamente o texto e a referência do versículo aprovado: não escolha outro, encurte ou parafraseie.',
  'Use linguagem concreta e acolhedora, adequada à faixa etária da etapa. Evite detalhes assustadores, violência gráfica e associar doenças, deficiência, medo ou ansiedade à possessão demoníaca.',
  'Proponha aplicações práticas ligadas ao propósito; não prometa ausência de fome, doença, sofrimento ou problemas materiais. Convites de fé e orações são voluntários, sem pressão ou exposição da criança.',
  'Entregue conteúdo completo e executável, sem frases interrompidas, instruções ausentes, placeholders ou recursos mencionados mas não fornecidos. Respeite os campos, quantidades, ordem e formato de impressão específicos da etapa.',
  'Perguntas, desafios e gabaritos devem corresponder ao conteúdo efetivamente ensinado e aos recursos fornecidos. Não cobre uma fala, informação ou desfecho ausente; confira se a atividade pode ser resolvida.',
  'Antes de devolver o JSON, revise fidelidade, clareza, completude, segurança e coerência com a lição e corrija os problemas encontrados. Não inclua essa revisão no material infantil.',
] as const;

export const LESSON_STAGE_QUALITY_RULES: Record<LessonStageType, string> = {
  [LessonStageType.LESSON]:
    'Conclua cada sub-história com seu desfecho bíblico e destaque os relatos separadamente. Mantenha propósito curto e concreto, narrativa participativa e aplicação para quem já crê e para quem deseja seguir Jesus.',
  [LessonStageType.LESSON_VISUALS]:
    'Cubra os momentos essenciais e o desfecho de cada sub-história aprovada, respeitando a quantidade solicitada. Vincule cada cena ao trecho literal da narrativa; mantenha personagens consistentes e não crie acontecimentos novos.',
  [LessonStageType.STANDARD_GAME]:
    'Forneça materiais acessíveis, preparação, passos em ordem, regras, duração e critério claro de encerramento. Explique a ligação prática com o propósito da lição. Inclua adaptações para 5–7 e 8–11 anos, participação de todos e segurança sem eliminação ou constrangimento.',
  [LessonStageType.VERSE_VISUALS]:
    'Confira que a concatenação dos trechos reproduz integralmente o versículo aprovado, sem omissão, repetição ou troca de palavras; encerre com a referência. Preserve a legibilidade e a diagramação exigidas para os cartões tipográficos.',
  [LessonStageType.VERSE_FIXATION]:
    'Entregue uma dinâmica completa, com preparação, materiais, regras, passos, duração e encerramento. Faça a criança compreender e memorizar o versículo aprovado por meio de participação lúdica; conclua com recitação completa, adapte às duas faixas etárias e não transforme a dinâmica em mera exibição de cartões.',
  [LessonStageType.MEDITATION_YOUNGER]:
    'Crie duas atividades complementares para 4–7 anos, priorizando labirinto/percurso/associação e reconhecimento com alternativas ou pintura seletiva. Desenho livre para colorir é excepcional. Confira todas as pistas, a solução verificável e os ids das artes; questão textual não recebe ilustração decorativa.',
  [LessonStageType.MEDITATION_OLDER]:
    'Crie três blocos substanciais para 8–11 anos, com 4–6 subitens de compreensão e enigmas completos de 5–8 pistas/palavras, ocupando a página inteira com conteúdo útil. Use o tema como título e somente referências no texto bíblico. Entregue instruções completas, elementos imprimíveis suficientes e gabarito conferido. A resposta deve ser verificável e corresponder exatamente ao desafio; relacione a aplicação ao cotidiano infantil.',
  [LessonStageType.MANUAL_WORK]:
    'Explique como realizar a atividade com o desenho fornecido e sua relação com a lição. Garanta áreas adequadas para colorir, margens para impressão e recorte seguro com ajuda de adulto quando necessário; não dependa de peças ou materiais ausentes.',
};
