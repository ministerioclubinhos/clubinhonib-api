import { LessonImagePurpose } from '../providers/lesson-llm.types';

export function lessonImageTextPolicy(purpose?: LessonImagePurpose): string {
  return purpose === LessonImagePurpose.MEDITATION_ACTIVITY
    ? 'Letras, números e rótulos curtos são permitidos somente quando indispensáveis ao enigma descrito, em português e legíveis. Não acrescente texto editorial, logotipos, marcas nem gabarito.'
    : 'Sem letras, palavras, números, logotipos ou marcas.';
}

export function buildMeditationActivityImagePrompt(
  ageGroup: string,
  instruction: string,
  proposedComposition: string,
  answer: string,
): string {
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
