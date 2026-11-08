import { EMAIL_SUBJECTS } from '../constants';
import { EmailContent, FeedPhotoCommentRejectedEmailData } from '../types';
import { joinTextLines, unsubscribeTextLines } from '../utils';
import { button, composeBody, paragraph, quoteBlock } from './blocks';
import { renderEmailLayout } from './layout';

export function feedPhotoCommentRejectedEmail(
  data: FeedPhotoCommentRejectedEmailData,
): EmailContent {
  return {
    subject: EMAIL_SUBJECTS.feedPhotoCommentRejected,
    html: renderEmailLayout({
      title: 'Seu comentário foi reprovado',
      recipientName: data.recipientName,
      body: composeBody([
        paragraph(
          'Um comentário seu no Feed Clubinho foi reprovado e não está publicado.',
        ),
        paragraph('Seu comentário:'),
        quoteBlock(data.commentText),
        paragraph('Motivo da reprovação:'),
        quoteBlock(data.reason),
        button('Abrir o Feed Clubinho', data.feedLink),
      ]),
      unsubscribeUrl: data.unsubscribeUrl,
    }),
    text: joinTextLines([
      `Olá, ${data.recipientName}!`,
      'Seu comentário no Feed Clubinho foi reprovado e não está publicado.',
      'Seu comentário:',
      data.commentText,
      'Motivo da reprovação:',
      data.reason,
      data.feedLink,
      ...unsubscribeTextLines(data.unsubscribeUrl),
    ]),
  };
}
