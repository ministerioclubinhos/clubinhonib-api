import { UserRole } from './auth.types';
import { normalizeRole } from './role.utils';

describe('normalizeRole', () => {
  it('reconhece os três papéis, em qualquer caixa', () => {
    expect(normalizeRole('admin')).toBe(UserRole.ADMIN);
    expect(normalizeRole('ADMIN')).toBe(UserRole.ADMIN);
    expect(normalizeRole('Coordinator')).toBe(UserRole.COORDINATOR);
    expect(normalizeRole('teacher')).toBe(UserRole.TEACHER);
  });

  it('ignora espaço em volta', () => {
    expect(normalizeRole('  admin  ')).toBe(UserRole.ADMIN);
  });

  it('papel desconhecido vira undefined, e não texto vazio', () => {
    // Antes a função devolvia `''`, que comparado com um papel escrito errado
    // ainda era uma comparação entre strings — e compilava.
    expect(normalizeRole('coordinaton')).toBeUndefined();
    expect(normalizeRole('root')).toBeUndefined();
  });

  it('ausência vira undefined', () => {
    expect(normalizeRole(undefined)).toBeUndefined();
    expect(normalizeRole(null)).toBeUndefined();
    expect(normalizeRole('')).toBeUndefined();
    expect(normalizeRole('   ')).toBeUndefined();
  });
});
