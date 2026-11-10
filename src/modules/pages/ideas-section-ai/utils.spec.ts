import { checkIdeaEssence } from './utils';
describe('idea essence deterministic checks', () => {
  it('accepts presentation changes without losing facts', () => {
    expect(
      checkIdeaEssence(
        'Use 3 bolas com Maria Silva. João 3:16.',
        'Com Maria Silva, use 3 bolas. João 3:16.',
      ).approved,
    ).toBe(true);
  });
  it('does not treat an instruction before a Bible reference as part of the reference or a person name', () => {
    expect(
      checkIdeaEssence(
        'Leia João 3:16 antes da atividade.',
        'Antes da atividade, leia João 3:16.',
      ).approved,
    ).toBe(true);
  });
  it.each([
    ['João 3:16', 'Lucas 3:16'],
    ['Use 3 bolas', 'Use 4 bolas'],
    ['Maria Silva participa', 'Outra pessoa participa'],
    ['Leia o texto', 'Leia https://evil.test'],
    ['Leia o texto', '<script>Leia o texto</script>'],
    ['Uma atividade completa para todos', 'Ok'],
  ])('rejects unsafe changes: %s', (original, enhanced) =>
    expect(checkIdeaEssence(original, enhanced).approved).toBe(false),
  );
});
