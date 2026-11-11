import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sources(path)
      : path.endsWith('.ts') && !path.endsWith('.spec.ts')
        ? [path]
        : [];
  });
}

describe('LLM queue architecture', () => {
  const root = join(__dirname, '../../..');
  it('keeps provider HTTP calls out of every AI feature', () => {
    const violations = sources(join(root, 'modules')).filter((path) => {
      // This existing helper only downloads signed S3 artwork; it is not an AI provider.
      if (
        relative(root, path) === 'modules/ai-lessons/utils/asset-url.utils.ts'
      )
        return false;
      const content = readFileSync(path, 'utf8');
      const aiFeature =
        path.includes('ai-lessons') ||
        path.includes('ideas-section-ai') ||
        /api\.openai\.com|generativelanguage\.googleapis\.com/.test(content);
      return (
        aiFeature &&
        /\b(?:axios\.(?:post|get|request|create)|fetch|https?\.request|generateContent|chat\.completions\.create|responses\.create)\s*[(<]/.test(
          content,
        )
      );
    });
    expect(violations.map((path) => relative(root, path))).toEqual([]);
  });

  it('allows only the worker to depend on the HTTP transport', () => {
    const consumers = sources(root)
      .filter((path) =>
        /from ['"].*ai-provider-transport\.provider['"]/.test(
          readFileSync(path, 'utf8'),
        ),
      )
      .map((path) => relative(root, path));
    expect(consumers.sort()).toEqual([
      'shared/providers/ai-queue/ai-request-queue.module.ts',
      'shared/providers/ai-queue/ai-request.processor.ts',
    ]);
  });
});
