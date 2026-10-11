import {
  normalizeOlderMeditationSequence,
  olderMeditationSequenceIssue,
} from './older-meditation-sequence.utils';
import {
  normalizeOlderMeditation,
  olderMeditationContentIssue,
} from './older-meditation-quality.utils';
import { olderMeditationFixture } from '../fixtures/older-meditation.fixture';
import type { MeditationJson } from '../types/younger-meditation.types';

function activity(): MeditationJson {
  return {
    mechanic: 'SEQUENCE',
    sequenceEvents: [
      { story: 'Relato A', text: 'A pessoa recebe ajuda.', order: 2 },
      { story: 'Relato B', text: 'A pessoa agradece.', order: 2 },
      { story: 'Relato A', text: 'A pessoa precisa de ajuda.', order: 1 },
      { story: 'Relato B', text: 'A pessoa pede ajuda.', order: 1 },
    ],
    supportText: 'Lista ambígua anterior',
    subitems: [
      { prompt: 'Ordene novamente.', options: [], answer: '1, 2, 3, 4' },
    ],
  };
}
describe('older meditation structured sequences', () => {
  it('calculates identifiers of the shuffled list independently for each story', () => {
    const normalized = normalizeOlderMeditationSequence(activity());
    const items = normalized.subitems as MeditationJson[];
    expect(items.map((item) => item.answer)).toEqual(['2, 1', '2, 1']);
    expect(normalized.supportText).toContain(
      'Relato: Relato A\n1) A pessoa recebe ajuda.\n2) A pessoa precisa de ajuda.',
    );
    expect(normalized.supportText).toContain('Relato: Relato B');
    expect(normalized.supportText).not.toContain('Lista ambígua anterior');
    expect(normalizeOlderMeditationSequence(normalized)).toEqual(normalized);
  });
  it('keeps the mapping correct with six events, without expecting ascending identifiers', () => {
    const content: MeditationJson = {
      sequenceEvents: Array.from({ length: 6 }, (_, index) => ({
        story: 'Relato',
        text: `Acontecimento ${index + 1}`,
        order: index + 1,
      })),
    };
    const normalized = normalizeOlderMeditationSequence(content);
    const events = normalized.sequenceEvents as MeditationJson[];
    const key = String((normalized.subitems as MeditationJson[])[0].answer)
      .split(', ')
      .map(Number);
    expect(
      key.map((id) => events.find((event) => event.displayedId === id)?.order),
    ).toEqual([1, 2, 3, 4, 5, 6]);
    expect(key).not.toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('rejects missing events, duplicate positions and gaps instead of inventing chronology', () => {
    expect(olderMeditationSequenceIssue({})).not.toBeNull();
    for (const order of [1, 3]) {
      const invalid = activity();
      (invalid.sequenceEvents as MeditationJson[])[0].order = order;
      expect(olderMeditationSequenceIssue(invalid)).toContain(
        'posições cronológicas',
      );
      expect(normalizeOlderMeditationSequence(invalid)).toEqual(invalid);
    }
  });
  it('prints each event once, omits internal chronology and accepts a complete structured sequence', () => {
    const content = olderMeditationFixture();
    const activities = content.activities as MeditationJson[];
    activities[0] = { ...activities[0], ...activity() };
    const normalized = normalizeOlderMeditation(content);
    const first = (normalized.activities as MeditationJson[])[0];
    expect(olderMeditationContentIssue(normalized)).toBeNull();
    expect(
      String(first.instruction).split('A pessoa recebe ajuda.'),
    ).toHaveLength(2);
    expect(first.instruction).not.toContain('2, 1');
    expect(first.instruction).not.toContain('Ordene novamente.');
    expect(normalizeOlderMeditation(normalized)).toEqual(normalized);
  });
});
