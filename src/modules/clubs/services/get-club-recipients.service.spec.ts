import { Test } from '@nestjs/testing';

import { GetUsersService } from 'src/core/user/services/get-user.service';
import { EmailRecipient } from 'src/shared/email';

import { ClubEntity } from '../entities/club.entity';
import { ClubsRepository } from '../repositories/clubs.repository';
import { GetClubRecipientsService } from './get-club-recipients.service';

const person = (id: string): EmailRecipient => ({
  id,
  name: `Pessoa ${id}`,
  email: `${id}@exemplo.com`,
});

/** Um clube com as relações que `findByIdWithRelationsOrFail` carrega. */
const club = (overrides: Partial<ClubEntity> = {}): ClubEntity =>
  ({
    id: 'club-1',
    number: 12,
    teachers: [{ user: { id: 'teacher-1' } }, { user: { id: 'teacher-2' } }],
    coordinator: { user: { id: 'coord-1' } },
    ...overrides,
  }) as ClubEntity;

describe('GetClubRecipientsService', () => {
  const clubsRepository = { findByIdWithRelationsOrFail: jest.fn() };
  const getUsersService = { findNoticeRecipientsByIds: jest.fn() };

  let service: GetClubRecipientsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        GetClubRecipientsService,
        { provide: ClubsRepository, useValue: clubsRepository },
        { provide: GetUsersService, useValue: getUsersService },
      ],
    }).compile();

    service = moduleRef.get(GetClubRecipientsService);
  });

  it('separa professores e coordenador do clubinho', async () => {
    clubsRepository.findByIdWithRelationsOrFail.mockResolvedValue(club());
    getUsersService.findNoticeRecipientsByIds.mockResolvedValue([
      person('teacher-1'),
      person('teacher-2'),
      person('coord-1'),
    ]);

    const result = await service.forClub('club-1');

    expect(result.clubNumber).toBe(12);
    expect(result.teachers.map((t) => t.id)).toEqual([
      'teacher-1',
      'teacher-2',
    ]);
    expect(result.coordinator?.id).toBe('coord-1');
  });

  /**
   * A régua de quem pode receber é do módulo de usuário: as consultas de clube
   * trazem professor desativado e quem se descadastrou.
   */
  it('deixa de fora quem o módulo de usuário não devolveu', async () => {
    clubsRepository.findByIdWithRelationsOrFail.mockResolvedValue(club());
    getUsersService.findNoticeRecipientsByIds.mockResolvedValue([
      person('teacher-1'),
    ]);

    const result = await service.forClub('club-1');

    expect(result.teachers.map((t) => t.id)).toEqual(['teacher-1']);
    expect(result.coordinator).toBeNull();
  });

  it('pergunta a elegibilidade de professores e coordenador de uma vez', async () => {
    clubsRepository.findByIdWithRelationsOrFail.mockResolvedValue(club());
    getUsersService.findNoticeRecipientsByIds.mockResolvedValue([]);

    await service.forClub('club-1');

    expect(getUsersService.findNoticeRecipientsByIds).toHaveBeenCalledTimes(1);
    expect(getUsersService.findNoticeRecipientsByIds).toHaveBeenCalledWith([
      'teacher-1',
      'teacher-2',
      'coord-1',
    ]);
  });

  /** As duas pontas são anuláveis no schema: nenhum dos dois é erro. */
  it('aceita clubinho sem coordenador e sem professor', async () => {
    clubsRepository.findByIdWithRelationsOrFail.mockResolvedValue(
      club({ teachers: [], coordinator: null }),
    );
    getUsersService.findNoticeRecipientsByIds.mockResolvedValue([]);

    const result = await service.forClub('club-1');

    expect(result.teachers).toEqual([]);
    expect(result.coordinator).toBeNull();
  });

  describe('forClubs', () => {
    it('indexa o resultado por clubinho', async () => {
      clubsRepository.findByIdWithRelationsOrFail.mockImplementation(
        (id: string) => Promise.resolve(club({ id })),
      );
      getUsersService.findNoticeRecipientsByIds.mockResolvedValue([
        person('coord-1'),
      ]);

      const result = await service.forClubs(['club-1', 'club-2']);

      expect([...result.keys()]).toEqual(['club-1', 'club-2']);
    });

    /**
     * O aviso de domingo percorre dezenas de clubes: um apagado no meio do
     * caminho não pode calar o resto.
     */
    it('segue com os outros quando um clubinho falha', async () => {
      clubsRepository.findByIdWithRelationsOrFail.mockImplementation(
        (id: string) =>
          id === 'club-1'
            ? Promise.reject(new Error('não encontrado'))
            : Promise.resolve(club({ id })),
      );
      getUsersService.findNoticeRecipientsByIds.mockResolvedValue([]);

      const result = await service.forClubs(['club-1', 'club-2']);

      expect([...result.keys()]).toEqual(['club-2']);
    });

    it('não consulta o mesmo clubinho duas vezes', async () => {
      clubsRepository.findByIdWithRelationsOrFail.mockResolvedValue(club());
      getUsersService.findNoticeRecipientsByIds.mockResolvedValue([]);

      await service.forClubs(['club-1', 'club-1']);

      expect(clubsRepository.findByIdWithRelationsOrFail).toHaveBeenCalledTimes(
        1,
      );
    });
  });
});
