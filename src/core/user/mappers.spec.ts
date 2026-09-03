import { UserEntity } from './entities/user.entity';
import { toMyProfileResponse } from './mappers';

/**
 * Trava o formato do perfil de quem está logado.
 *
 * `GET /profile` e `GET /auth/me` respondem por este mesmo mapper, e o front
 * declara os mesmos campos em `src/features/profile/types.ts`. Se um campo
 * entrar ou sair aqui sem entrar ou sair lá, os dois lados divergem sem
 * ninguém perceber até a tela quebrar.
 */
describe('toMyProfileResponse (contrato do próprio perfil)', () => {
  const user = {
    id: 'user-1',
    email: 'fulano@example.com',
    name: 'Fulano de Tal',
    phone: '92999990000',
    cpf: '12345678901',
    role: 'teacher',
    active: true,
    completed: true,
    commonUser: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    teacherProfile: {
      id: 'teacher-1',
      active: true,
      club: {
        id: 'club-1',
        number: 12,
        weekday: 'saturday',
        time: '14:30',
        isActive: true,
      },
    },
    coordinatorProfile: null,
  } as unknown as UserEntity;

  it('expõe exatamente os campos do contrato', () => {
    const response = toMyProfileResponse({ user });

    expect(Object.keys(response).sort()).toEqual(
      [
        'active',
        'commonUser',
        'completed',
        'coordinatorProfile',
        'cpf',
        'createdAt',
        'email',
        'id',
        'image',
        'name',
        'personalData',
        'phone',
        'preferences',
        'role',
        'teacherProfile',
        'updatedAt',
      ].sort(),
    );
  });

  it('leva active, completed e os carimbos de data', () => {
    const response = toMyProfileResponse({ user });

    // `/auth/me` não mandava nenhum destes quatro, e a tela de perfil os
    // exibe — por isso os dois endpoints agora passam pelo mesmo mapper.
    expect(response.active).toBe(true);
    expect(response.completed).toBe(true);
    expect(response.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(response.updatedAt).toBe('2026-01-02T00:00:00.000Z');
  });

  it('achata o vínculo de professor com o clubinho', () => {
    const response = toMyProfileResponse({ user });

    expect(response.teacherProfile).toEqual({
      id: 'teacher-1',
      active: true,
      club: {
        id: 'club-1',
        number: 12,
        weekday: 'saturday',
        time: '14:30',
        isActive: true,
      },
    });
    expect(response.coordinatorProfile).toBeNull();
  });

  it('devolve nulo no que não existe, em vez de omitir a chave', () => {
    const response = toMyProfileResponse({
      user: {
        ...user,
        cpf: null,
        teacherProfile: null,
      } as unknown as UserEntity,
    });

    expect(response.cpf).toBeNull();
    expect(response.image).toBeNull();
    expect(response.teacherProfile).toBeNull();
  });

  it('entrega a foto no recorte do contrato, sem a entidade inteira', () => {
    const response = toMyProfileResponse({
      user,
      image: {
        id: 'media-1',
        title: 'Foto',
        description: null,
        url: 'https://example.com/foto.jpg',
        uploadType: 'upload',
        mediaType: 'image',
        isLocalFile: true,
        platformType: null,
        originalName: 'foto.jpg',
        size: 1024,
        targetId: 'user-1',
        targetType: 'UserEntity',
      } as never,
    });

    expect(Object.keys(response.image ?? {}).sort()).toEqual(
      [
        'description',
        'id',
        'isLocalFile',
        'mediaType',
        'originalName',
        'platformType',
        'size',
        'title',
        'uploadType',
        'url',
      ].sort(),
    );
    // Colunas internas da mídia não vazam para a resposta.
    expect(response.image).not.toHaveProperty('targetId');
    expect(response.image).not.toHaveProperty('targetType');
  });

  it('devolve a data de nascimento como dia de calendário', () => {
    const response = toMyProfileResponse({
      user,
      personalData: {
        birthDate: new Date('1990-05-20T00:00:00Z'),
        gender: 'Masculino',
      } as never,
    });

    expect(response.personalData?.birthDate).toBe('1990-05-20');
  });
});
