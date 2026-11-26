import { isValidYoutubeUrl, parseYoutubeVideoId } from './youtube-url';

describe('YouTube URL validation', () => {
  it.each([
    'https://www.youtube.com/watch?v=abcdefghijk',
    'https://youtube.com/watch?v=abcdefghijk',
    'https://m.youtube.com/watch?v=abcdefghijk',
    'https://youtu.be/abcdefghijk',
    'https://www.youtube.com/shorts/abcdefghijk',
    'https://www.youtube.com/embed/abcdefghijk',
  ])('accepts %s', (url) => expect(isValidYoutubeUrl(url)).toBe(true));

  it.each([
    '',
    '   ',
    'javascript:alert(1)',
    'https://youtube.com.evil.com/watch?v=abcdefghijk',
    'https://youtu.be/short',
    'https://youtube.com/watch?v=invalid!',
  ])('rejects %s', (url) => expect(parseYoutubeVideoId(url)).toBeNull());
});
