import { feedPhotoCommentRejectedEmail } from './feed-photo-comment-rejected.template';

describe('Feed photo rejection email', () => {
  it('includes the reason and comment in both formats and escapes untrusted HTML', () => {
    const result = feedPhotoCommentRejectedEmail({
      recipientName: 'Ana',
      commentText: '<script>bad()</script>',
      reason: '<img src=x onerror=bad()>',
      feedLink: 'https://example.test/feed-clubinho',
      unsubscribeUrl: 'https://example.test/descadastrar',
    });
    expect(result.subject).toContain('reprovado');
    expect(result.html).not.toContain('<script>');
    expect(result.html).not.toContain('<img src=x');
    expect(result.html).toContain('&lt;script&gt;');
    expect(result.html).toContain('&lt;img');
    expect(result.text).toContain('<script>bad()</script>');
    expect(result.text).toContain('<img src=x onerror=bad()>');
    expect(result.text).toContain('https://example.test/descadastrar');
  });
});
