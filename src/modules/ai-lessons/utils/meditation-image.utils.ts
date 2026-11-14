import { CUTOUT_CUT_LINE_RULE } from '../constants/lesson-visual-style.constants';
import { LessonImagePurpose } from '../providers/lesson-llm.types';

export function lessonImageTextPolicy(purpose?: LessonImagePurpose): string {
  if (purpose === LessonImagePurpose.MANUAL_COLORING)
    return 'Imagem para pintar: somente contornos pretos, interiores brancos e fundo branco puro. Sem cores, cinza, sombras, texturas, preenchimentos, letras ou logotipos.';
  if (purpose === LessonImagePurpose.CUTOUT_SHEET)
    return `Sem letras, números, logotipos ou legendas. Elementos isolados em fundo branco puro. ${CUTOUT_CUT_LINE_RULE}`;
  if (purpose === LessonImagePurpose.GAME_SUMMARY)
    return 'Infográfico com texto: escreva em português do Brasil, legível e com ortografia correta, o título da brincadeira, os nomes das faixas, os números e títulos curtos dos passos e a frase de encerramento pedidos a seguir. Nenhuma faixa, placa ou etiqueta pode ficar em branco. Sem logotipos ou marcas.';
  return purpose === LessonImagePurpose.MEDITATION_ACTIVITY
    ? 'Letras, números e rótulos curtos são permitidos somente quando indispensáveis ao enigma descrito, em português e legíveis. Não acrescente texto editorial, logotipos, marcas nem gabarito.'
    : 'Sem letras, palavras, números, logotipos ou marcas.';
}

export function buildMeditationActivityImagePrompt(
  ageGroup: string,
  instruction: string,
  proposedComposition: string,
  answer: string,
  supportImage = false,
): string {
  if (supportImage)
    return `Crie uma imagem de anexo ou apoio à questão para crianças de ${ageGroup}.
QUESTÃO: ${instruction}
COMPOSIÇÃO PLANEJADA: ${proposedComposition}
GABARITO INTERNO, NÃO REVELAR: ${answer}
A imagem pode ilustrar a situação e os elementos relevantes ou conter os dados visuais do desafio. Não invente outro jogo. Não repita enunciados ou alternativas já impressos. Não indique a resposta, não mostre o caminho resolvido, pares ligados ou alternativas destacadas. Em apoio contextual, não transforme a cena em enigma. Use traços limpos, fundo branco, composição compacta e legível, sem cabeçalho, logotipo, versículo ou oração. Preserve os dados e legendas indispensáveis se a atividade exigir elementos visuais executáveis.`;
  return `Crie somente os elementos imprimíveis necessários à atividade para crianças de ${ageGroup}.
INSTRUÇÃO REAL: ${instruction}
COMPOSIÇÃO PLANEJADA: ${proposedComposition}
SOLUÇÃO PARA CONFERÊNCIA INTERNA, NÃO PARA IMPRIMIR: ${answer}
A imagem deve ser o desafio executável, não uma cena decorativa para colorir.
Preserve todos os caminhos, entradas, saídas, alternativas, pontos, letras, símbolos e legendas exigidos.
Use traços limpos, fundo branco, composição compacta e legível com margem segura.
Letras, números e palavras curtas devem ser grandes, em português e copiados exatamente da descrição.
Labirinto: entrada e destino claros, corredores abertos e percurso alcançável, sem marcar o caminho correto.
Sequência/código: inclua os caracteres e a legenda completa, formando exatamente a solução interna.
Associação/escolha: inclua todas as alternativas e não ligue nem destaque a correta.
Pontos/figura escondida: marque somente as áreas que revelam a figura pedida, sem pintar a solução.
Não acrescente cabeçalho, logotipo, instrução completa, número externo da questão, versículo, oração ou gabarito.
Confira que é possível executar o comando apenas com os elementos impressos antes de concluir.`;
}
