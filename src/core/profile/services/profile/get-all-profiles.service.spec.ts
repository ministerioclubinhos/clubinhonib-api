import { Test } from '@nestjs/testing';

import { UserRole } from 'src/core/auth/auth.types';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { AppForbiddenException } from 'src/shared/exceptions';

import { PROFILES_MAX_LIMIT } from '../../constants';
import { QueryProfilesDto } from '../../dto/query-profiles.dto';
import { PersonalDataRepository } from '../../repositories/personal-data.repository';
import { ProfilesListingRepository } from '../../repositories/profiles-listing.repository';
import { UserPreferencesRepository } from '../../repositories/user-preferences.repository';
import { GetAllProfilesService } from './get-all-profiles.service';

describe('GetAllProfilesService', () => {
  const listingRepository = {
    findPage: jest.fn(),
    findBirthdaysOfCurrentMonth: jest.fn(),
  };
  const personalDataRepository = { findByUserIds: jest.fn() };
  const userPreferencesRepository = { findByUserIds: jest.fn() };
  const mediaItemProcessor = { findManyMediaItemsByTargets: jest.fn() };

  const buildQuery = (overrides: Partial<QueryProfilesDto> = {}) =>
    Object.assign(new QueryProfilesDto(), { page: 1, limit: 12 }, overrides);

  const buildService = async (): Promise<GetAllProfilesService> => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GetAllProfilesService,
        { provide: ProfilesListingRepository, useValue: listingRepository },
        { provide: PersonalDataRepository, useValue: personalDataRepository },
        {
          provide: UserPreferencesRepository,
          useValue: userPreferencesRepository,
        },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
      ],
    }).compile();

    return moduleRef.get(GetAllProfilesService);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    listingRepository.findPage.mockResolvedValue({
      users: [
        {
          id: 'user-1',
          email: 'um@example.com',
          phone: '92999990000',
          name: 'Fulano',
          role: 'teacher',
        },
        {
          id: 'user-2',
          email: 'dois@example.com',
          phone: '92999990001',
          name: 'Beltrano',
          role: 'teacher',
        },
      ],
      total: 2,
    });
    listingRepository.findBirthdaysOfCurrentMonth.mockResolvedValue([]);
    personalDataRepository.findByUserIds.mockResolvedValue([]);
    userPreferencesRepository.findByUserIds.mockResolvedValue([]);
    mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([]);
  });

  it('barra quem não pode listar perfis', async () => {
    const service = await buildService();

    await expect(
      service.execute({ role: UserRole.TEACHER, userId: 'u1' }, buildQuery()),
    ).rejects.toBeInstanceOf(AppForbiddenException);

    expect(listingRepository.findPage).not.toHaveBeenCalled();
  });

  /**
   * A versão anterior fazia duas idas ao banco por linha da página; com doze
   * linhas eram vinte e quatro consultas só para montar uma tela.
   */
  it('carrega dados pessoais e preferências em uma consulta cada', async () => {
    const service = await buildService();

    await service.execute(
      { role: UserRole.ADMIN, userId: 'admin-1' },
      buildQuery(),
    );

    expect(personalDataRepository.findByUserIds).toHaveBeenCalledTimes(1);
    expect(personalDataRepository.findByUserIds).toHaveBeenCalledWith([
      'user-1',
      'user-2',
    ]);
    expect(userPreferencesRepository.findByUserIds).toHaveBeenCalledTimes(1);
  });

  it('devolve a paginação coerente com a página pedida', async () => {
    const service = await buildService();

    const result = await service.execute(
      { role: UserRole.ADMIN, userId: 'admin-1' },
      buildQuery({ page: 2, limit: 1 }),
    );

    expect(result.meta).toEqual({
      currentPage: 2,
      itemsPerPage: 1,
      totalItems: 2,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true,
    });
  });

  /** O teto existe para a listagem não virar um despejo do banco. */
  it('limita a página ao teto, mesmo se um valor maior escapar da validação', async () => {
    const service = await buildService();

    await service.execute(
      { role: UserRole.ADMIN, userId: 'admin-1' },
      buildQuery({ limit: 5000 }),
    );

    expect(listingRepository.findPage).toHaveBeenCalledWith(
      UserRole.ADMIN,
      'admin-1',
      expect.anything(),
      PROFILES_MAX_LIMIT,
      0,
    );
  });

  describe('aniversariantes', () => {
    it('barra quem não pode listar perfis', async () => {
      const service = await buildService();

      await expect(
        service.findBirthdaysOfCurrentMonth({
          role: UserRole.TEACHER,
          userId: 'u1',
        }),
      ).rejects.toBeInstanceOf(AppForbiddenException);
    });

    it('devolve só o recorte que a faixa mostra', async () => {
      listingRepository.findBirthdaysOfCurrentMonth.mockResolvedValue([
        {
          id: 'user-1',
          name: 'Fulano',
          role: 'teacher',
          birthDate: new Date('1990-05-20T00:00:00Z'),
        },
      ]);

      const service = await buildService();
      const [birthday] = await service.findBirthdaysOfCurrentMonth({
        role: UserRole.ADMIN,
        userId: 'admin-1',
      });

      expect(Object.keys(birthday).sort()).toEqual(
        ['birthDate', 'id', 'image', 'name', 'role'].sort(),
      );
      expect(birthday.birthDate).toBe('1990-05-20');
      expect(birthday).not.toHaveProperty('email');
      expect(birthday).not.toHaveProperty('phone');
    });
  });
});
