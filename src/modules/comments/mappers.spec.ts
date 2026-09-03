import { CommentEntity } from './entities/comment.entity';
import { toCommentResponse } from './mappers';

/** Trava o formato da resposta de comentários. */
describe('toCommentResponse (contrato de resposta)', () => {
  const comment = {
    id: 'comment-1',
    name: 'João Pedro',
    comment: 'Meu filho ama o clubinho.',
    clubinho: '12',
    neighborhood: 'Centro',
    published: true,
    createdAt: new Date('2026-03-01T10:00:00Z'),
    updatedAt: new Date('2026-03-02T10:00:00Z'),
  } as unknown as CommentEntity;

  it('expõe exatamente os campos do contrato', () => {
    expect(Object.keys(toCommentResponse(comment)).sort()).toEqual(
      [
        'clubinho',
        'comment',
        'createdAt',
        'id',
        'name',
        'neighborhood',
        'published',
        'updatedAt',
      ].sort(),
    );
  });

  it('normaliza a publicação para booleano', () => {
    // A coluna é anulável na entidade; o contrato promete booleano.
    const semPublicacao = { ...comment, published: undefined };

    expect(
      toCommentResponse(semPublicacao as unknown as CommentEntity).published,
    ).toBe(false);
  });
});
