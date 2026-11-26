import { toCompleteProfileResponse } from './mappers';
import { ProfileUserSource } from './types';

/**
 * Trava o formato de `/profiles`.
 *
 * O front declara os mesmos campos em `src/features/profile/types.ts` como
 * `CompleteProfile`.
 */
describe('toCompleteProfileResponse (contrato de /profiles)', () => {
  const user: ProfileUserSource = {
    id: 'user-1',
    email: 'fulano@example.com',
    phone: '92999990000',
    name: 'Fulano de Tal',
    role: 'coordinator',
  };

  it('expõe exatamente os campos do contrato', () => {
    expect(Object.keys(toCompleteProfileResponse({ user })).sort()).toEqual(
      [
        'email',
        'id',
        'image',
        'name',
        'personalData',
        'phone',
        'preferences',
        'role',
      ].sort(),
    );
  });

  it('devolve a foto mesmo quando não há dados pessoais', () => {
    const response = toCompleteProfileResponse({
      user,
      image: {
        id: 'media-1',
        title: null,
        description: null,
        url: 'https://example.com/foto.jpg',
        uploadType: 'upload',
        mediaType: 'image',
        isLocalFile: true,
        platformType: null,
        originalName: null,
        size: null,
      } as never,
    });

    // A edição devolvia o perfil sem a foto que a leitura devolvia; agora as
    // duas passam pelo mesmo mapper.
    expect(response.image?.url).toBe('https://example.com/foto.jpg');
    expect(response.personalData).toBeUndefined();
    expect(response.preferences).toBeUndefined();
  });

  it('não expõe as colunas internas da mídia', () => {
    const response = toCompleteProfileResponse({
      user,
      image: {
        id: 'media-1',
        url: 'https://example.com/foto.jpg',
        uploadType: 'upload',
        mediaType: 'image',
        isLocalFile: true,
        targetId: 'user-1',
        targetType: 'UserEntity',
      } as never,
    });

    expect(response.image).not.toHaveProperty('targetId');
    expect(response.image).not.toHaveProperty('targetType');
  });
});
