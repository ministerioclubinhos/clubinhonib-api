import { LessonCategory } from '../enums/lesson.enums';
import { LessonImageContext } from '../providers/lesson-llm.types';

export function lessonImageContextPrompt(context?: LessonImageContext): string {
  return context?.category === LessonCategory.SPECIAL
    ? 'Ilustração infantil do Clubinho NIB. A ambientação é a da cena aprovada: contemporânea, bíblica ou histórica. Preserve roupas, objetos e arquitetura da época indicada em cada trecho. Ficção contemporânea é uma ilustração, nunca um fato bíblico. A imagem de referência orienta o estilo e a identidade dos personagens que reaparecem; não transfira personagens, roupas ou cenários entre épocas diferentes. Não desenhe o professor nem objetos de apoio citados apenas em dicas de apresentação.'
    : 'Ilustração bíblica infantil do Clubinho NIB. Fidelidade ao contexto bíblico da NVI e à descrição fechada recebida da lição aprovada.';
}
