import { SiteFeedbackEntity } from './entities/site-feedback.entity';
import { FeedbackCategory } from './entities/feedback-category.enum';
import { toSiteFeedbackResponse } from './mappers';

/** Trava o formato da resposta de avaliações do site. */
describe('toSiteFeedbackResponse (contrato de resposta)', () => {
  const feedback = {
    id: 'feedback-1',
    name: 'Ana Souza',
    email: 'ana@example.com',
    rating: 4,
    comment: 'Site muito bom.',
    category: FeedbackCategory.USABILITY,
    read: false,
    createdAt: new Date('2026-03-01T10:00:00Z'),
    updatedAt: new Date('2026-03-02T10:00:00Z'),
  } as unknown as SiteFeedbackEntity;

  it('expõe exatamente os campos do contrato', () => {
    expect(Object.keys(toSiteFeedbackResponse(feedback)).sort()).toEqual(
      [
        'category',
        'comment',
        'createdAt',
        'email',
        'id',
        'name',
        'rating',
        'read',
        'updatedAt',
      ].sort(),
    );
  });

  it('devolve nulo no e-mail ausente, em vez de omitir a chave', () => {
    // Avaliações antigas foram gravadas antes de a rota exigir autenticação.
    const semEmail = { ...feedback, email: undefined };

    expect(
      toSiteFeedbackResponse(semEmail as unknown as SiteFeedbackEntity).email,
    ).toBeNull();
  });
});
