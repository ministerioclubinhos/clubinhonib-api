import { PagelaEntity } from './entities/pagela.entity';
import { toPagelaResponse } from './mappers';

/**
 * Trava o formato da resposta de pagelas.
 *
 * O front declara estes mesmos campos em `src/features/pagelas/types.ts`. Se
 * um campo entrar ou sair aqui sem entrar ou sair lá, os dois lados divergem
 * sem ninguém perceber até a tela quebrar.
 */
describe('toPagelaResponse (contrato de resposta)', () => {
  const pagela = {
    id: 'pagela-1',
    child: { id: 'child-1' },
    teacher: { id: 'teacher-1' },
    referenceDate: '2026-03-07',
    year: 2026,
    week: 5,
    present: true,
    didMeditation: false,
    recitedVerse: true,
    notes: 'Chegou atrasado',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  } as unknown as PagelaEntity;

  it('expõe exatamente os campos do contrato', () => {
    expect(Object.keys(toPagelaResponse(pagela)).sort()).toEqual(
      [
        'childId',
        'createdAt',
        'createdBy',
        'didMeditation',
        'id',
        'notes',
        'present',
        'recitedVerse',
        'referenceDate',
        'teacherProfileId',
        'updatedAt',
        'updatedBy',
        'week',
        'year',
      ].sort(),
    );
  });

  it('achata os vínculos em identificadores', () => {
    const response = toPagelaResponse(pagela);

    expect(response.childId).toBe('child-1');
    expect(response.teacherProfileId).toBe('teacher-1');
  });

  it('devolve nulo no professor ausente e na observação vazia', () => {
    const response = toPagelaResponse({
      ...pagela,
      teacher: null,
      notes: undefined,
    } as unknown as PagelaEntity);

    expect(response.teacherProfileId).toBeNull();
    expect(response.notes).toBeNull();
  });

  it('entrega as datas em ISO', () => {
    const response = toPagelaResponse(pagela);

    expect(response.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(response.updatedAt).toBe('2026-01-02T00:00:00.000Z');
    // A data do encontro é dia de calendário, e sai como veio.
    expect(response.referenceDate).toBe('2026-03-07');
  });

  it('leva só o id e o nome de quem lançou e de quem alterou', () => {
    const response = toPagelaResponse({
      ...pagela,
      createdBy: { id: 'user-1', name: 'Ana', password: 'segredo' },
      updatedBy: null,
    } as unknown as typeof pagela);

    expect(response.createdBy).toEqual({ id: 'user-1', name: 'Ana' });
    expect(response.updatedBy).toBeNull();
  });
});
