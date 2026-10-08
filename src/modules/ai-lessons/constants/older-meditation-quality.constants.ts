export const OLDER_MEDITATION_MIN_ACTIVITY_WORDS = 200;
export const OLDER_MEDITATION_MAX_CORRECTIONS = 2;
export const OLDER_MEDITATION_MAX_BLOCK_CORRECTIONS = 3;
export const OLDER_MEDITATION_BLOCK_TARGET_WORDS = 110;
export const OLDER_MEDITATION_BLOCK_SUBITEMS = 6;
export const OLDER_MEDITATION_BLOCK_REVISION_PROMPT =
  'Corrija SOMENTE um bloco textual da meditação para 8–11 anos, usando os fatos da lição aprovada. Retorne context, command, seis subitems completos e seis answers correspondentes, na mesma ordem. Cada subitem contém o enunciado e todas as alternativas/pistas necessárias e tem cerca de 18–25 palavras. Não entregue palavras isoladas ou perguntas genéricas. Cubra compreensão, sequência dos fatos e aplicação concreta. Não gere cabeçalho, outros blocos, imagens ou caça-palavras. Os subitens serão impressos; answers contém somente o gabarito interno. Respeite minimumWords no total de context, command e subitems. Não use repetição para atingir a extensão.';
export const OLDER_MEDITATION_INSTRUCTION_DESCRIPTION =
  'Bloco imprimível completo para 8–11 anos, com cerca de 100–140 palavras. Inclua contexto breve, comando e 4–6 subitens com todas as pistas e alternativas dentro desta string, separados por quebras de linha. Não coloque as questões em answer ou printableAssets.prompt. Os três blocos somam 300–420 palavras; answer contém somente o gabarito.';
export const OLDER_MEDITATION_EXPANSION_INSTRUCTIONS = `A tentativa anterior ficou superficial ou incompleta. Refaça a meditação dos maiores como uma folha completa para 8–11 anos: três blocos substanciais ligados ao tema aprovado, com 4–6 subitens nos blocos de compreensão e um enigma completo com 5–8 pistas ou palavras. Entregue 300–500 palavras nas instruções, incluindo todas as alternativas e pistas, com gabarito por subitem. Não entregue três perguntas isoladas. Título deve ser o tema da lição; biblicalText deve ser somente as referências bíblicas. Não use Markdown ou imagens que revelem a solução.`;
