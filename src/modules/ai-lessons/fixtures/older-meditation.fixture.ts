import type { MeditationJson } from '../types/younger-meditation.types';
import {
  OlderMeditationMechanic as M,
  OlderMeditationGoal as G,
} from '../enums/older-meditation.enums';

export function olderMeditationFixture(
  theme = 'O bom samaritano',
): MeditationJson {
  return {
    title: theme,
    ageGroup: '8 a 11 anos',
    verseText: 'Ame o seu próximo como a si mesmo.',
    verseReference: 'Lucas 10:27',
    verseVersion: 'NVI',
    biblicalText: 'Lucas 10:25-37',
    introduction:
      'Na história estudada, pessoas tomaram decisões diferentes diante de alguém que precisava de ajuda. Observe suas atitudes e pense em como cuidar do próximo.',
    prayer:
      'Senhor, ajuda-me a perceber quem precisa de cuidado e agir com amor.',
    activities: [
      {
        number: 1,
        mechanic: M.FILL_BLANK,
        goal: G.NARRATIVE,
        sourceExcerpt: 'Um samaritano cuidou do homem ferido.',
        context: 'Recorde os acontecimentos da história.',
        command: 'Complete usando o banco de palavras.',
        supportText: 'Palavras: caminho, ferido, samaritano, hospedaria.',
        visualRequired: true,
        subitems: [
          {
            prompt: 'O homem viajava por um ______.',
            options: [],
            answer: 'caminho',
          },
          {
            prompt: 'Depois do ataque, ele ficou ______.',
            options: [],
            answer: 'ferido',
          },
          {
            prompt: 'Quem parou para ajudar foi um ______.',
            options: [],
            answer: 'samaritano',
          },
          {
            prompt: 'Para continuar o cuidado, levou-o a uma ______.',
            options: [],
            answer: 'hospedaria',
          },
        ],
      },
      {
        number: 2,
        mechanic: M.MULTIPLE_CHOICE,
        goal: G.COMPREHENSION,
        sourceExcerpt: 'Um samaritano cuidou do homem ferido.',
        context: 'Considere as decisões das pessoas do relato.',
        command: 'Marque uma resposta para cada pergunta.',
        supportText: '',
        visualRequired: true,
        subitems: [
          {
            prompt:
              'Qual atitude tornou o viajante um próximo do homem ferido?',
            options: [
              'Observar a situação de longe',
              'Parar e cuidar de suas necessidades',
              'Avisar que outras pessoas passariam',
            ],
            answer: 'Parar e cuidar de suas necessidades',
          },
          {
            prompt:
              'Por que levar o homem a um lugar seguro também foi importante?',
            options: [
              'O cuidado precisava continuar',
              'O viajante queria terminar uma tarefa rapidamente',
              'Era preciso descobrir quem atacou',
            ],
            answer: 'O cuidado precisava continuar',
          },
          {
            prompt: 'O que a ajuda do samaritano mostra sobre o amor?',
            options: [
              'Depende de conhecer bem a pessoa',
              'Pode ser demonstrado em ações concretas',
              'Consiste somente em sentir tristeza',
            ],
            answer: 'Pode ser demonstrado em ações concretas',
          },
          {
            prompt: 'Qual decisão mostra atenção à necessidade de alguém?',
            options: [
              'Esperar a pessoa pedir várias vezes',
              'Deixar tudo para quem chegar depois',
              'Perceber a dificuldade e oferecer ajuda possível',
            ],
            answer: 'Perceber a dificuldade e oferecer ajuda possível',
          },
        ],
      },
      {
        number: 3,
        mechanic: M.SHORT_ANSWER,
        goal: G.APPLICATION,
        sourceExcerpt: 'Um samaritano cuidou do homem ferido.',
        context:
          'No recreio, um colega está sozinho porque perdeu seu lanche. Você percebe que ele está triste.',
        command: 'Pense numa atitude possível e escreva respostas curtas.',
        supportText: '',
        visualRequired: true,
        subitems: [
          {
            prompt:
              'Como você poderia ajudá-lo com respeito? ____________________',
            options: [],
            answer:
              'Aceitar atitudes concretas e respeitosas: conversar, compartilhar quando possível ou procurar um adulto responsável.',
          },
          {
            prompt:
              'Como essa atitude se relaciona com o cuidado mostrado na história? ____________________',
            options: [],
            answer:
              'Relacionar perceber uma necessidade e agir para cuidar do próximo, sem exigir experiência pessoal específica.',
          },
        ],
      },
    ],
    printableAssets: [
      {
        id: '1',
        prompt:
          'Cena de apoio do caminho e da hospedaria, sem texto e sem destacar respostas.',
        purpose: 'Apoio à narrativa',
        altText: 'Caminho e hospedaria da história',
      },
      {
        id: '2',
        prompt:
          'Cena de apoio do encontro no caminho, sem indicar alternativas corretas.',
        purpose: 'Apoio à compreensão',
        altText: 'Encontro no caminho',
      },
      {
        id: '3',
        prompt:
          'Cena do recreio com uma criança triste, sem mostrar a solução da pergunta.',
        purpose: 'Apoio à aplicação',
        altText: 'Colega no recreio',
      },
    ],
  };
}

export const OLDER_MEDITATION_SOURCE = {
  story: 'Um samaritano cuidou do homem ferido.',
};
