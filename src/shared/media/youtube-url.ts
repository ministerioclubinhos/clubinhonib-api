export const YOUTUBE_ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
]);

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function parseYoutubeVideoId(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (!YOUTUBE_ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return null;
    let id: string | null = null;
    if (url.hostname.toLowerCase() === 'youtu.be') {
      id = url.pathname.split('/').filter(Boolean)[0] ?? null;
    } else if (url.pathname === '/watch') {
      id = url.searchParams.get('v');
    } else {
      const match = url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)$/);
      id = match?.[1] ?? null;
    }
    return id && VIDEO_ID_PATTERN.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function isValidYoutubeUrl(value: string): boolean {
  return parseYoutubeVideoId(value) !== null;
}
