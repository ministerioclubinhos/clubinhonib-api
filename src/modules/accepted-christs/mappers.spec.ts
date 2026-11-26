import { AcceptedChristEntity } from './entities/accepted-christ.entity';
import { DecisionType } from './enums/decision-type.enum';
import { toAcceptedChristResponse, toAcceptedChristShort } from './mappers';

/**
 * A rota devolvia a entidade do TypeORM, que traz a relação `child` inteira —
 * responsável, telefone e endereço junto de cada decisão gravada.
 */
describe('mappers de decisão', () => {
  const entity = {
    id: 'decision-1',
    decision: DecisionType.ACCEPTED,
    notes: 'Conversou com a professora depois da aula.',
    createdAt: new Date('2026-03-10T12:00:00Z'),
    updatedAt: new Date('2026-03-10T12:00:00Z'),
    child: {
      id: 'child-1',
      name: 'Ana Souza',
      guardianName: 'Marta Souza',
      guardianPhone: '92999990000',
    },
  } as unknown as AcceptedChristEntity;

  describe('toAcceptedChristResponse', () => {
    it('expõe exatamente os campos do contrato', () => {
      const response = toAcceptedChristResponse(entity, 'child-1');

      expect(Object.keys(response).sort()).toEqual(
        [
          'childId',
          'createdAt',
          'createdBy',
          'decision',
          'id',
          'notes',
          'updatedAt',
        ].sort(),
      );
    });

    it('não deixa a criança sair junto', () => {
      const response = toAcceptedChristResponse(entity, 'child-1');

      expect(response).not.toHaveProperty('child');
      expect(response.childId).toBe('child-1');
      expect(JSON.stringify(response)).not.toContain('Marta Souza');
      expect(JSON.stringify(response)).not.toContain('92999990000');
    });

    it('devolve os carimbos em ISO e a observação ausente como nula', () => {
      const response = toAcceptedChristResponse(
        { ...entity, notes: undefined } as unknown as AcceptedChristEntity,
        'child-1',
      );

      expect(response.createdAt).toBe('2026-03-10T12:00:00.000Z');
      expect(response.notes).toBeNull();
    });
  });

  describe('toAcceptedChristShort', () => {
    /** É o recorte que a listagem de crianças embute em cada linha. */
    it('não leva a observação nem a criança', () => {
      const short = toAcceptedChristShort(entity);

      expect(Object.keys(short).sort()).toEqual(
        ['createdAt', 'createdBy', 'decision', 'id', 'updatedAt'].sort(),
      );
    });
  });
});
