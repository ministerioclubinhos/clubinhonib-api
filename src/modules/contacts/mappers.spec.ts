import { ContactEntity } from './entities/contact.entity';
import { toContactResponse } from './mappers';

/**
 * Trava o formato da resposta de contatos.
 *
 * O front declara os mesmos campos em `src/features/contacts/types.ts`. Antes
 * a rota devolvia a entidade crua, e qualquer coluna nova vazaria sozinha.
 */
describe('toContactResponse (contrato de resposta)', () => {
  const contact = {
    id: 'contact-1',
    name: 'Maria Silva',
    email: 'maria@example.com',
    phone: '92999990000',
    message: 'Gostaria de saber mais sobre o clubinho.',
    read: false,
    createdAt: new Date('2026-03-01T10:00:00Z'),
    updatedAt: new Date('2026-03-02T10:00:00Z'),
  } as unknown as ContactEntity;

  it('expõe exatamente os campos do contrato', () => {
    expect(Object.keys(toContactResponse(contact)).sort()).toEqual(
      [
        'createdAt',
        'email',
        'id',
        'message',
        'name',
        'phone',
        'read',
        'updatedAt',
      ].sort(),
    );
  });

  it('entrega as datas em ISO', () => {
    const response = toContactResponse(contact);

    expect(response.createdAt).toBe('2026-03-01T10:00:00.000Z');
    expect(response.updatedAt).toBe('2026-03-02T10:00:00.000Z');
  });
});
