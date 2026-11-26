import { ClubEntity } from './entities/club.entity';
import { Weekday } from './entities/weekday.enum';
import {
  toClubResponse,
  toClubSelectOption,
  toClubSimpleResponse,
} from './mappers';

/**
 * Trava o formato das respostas de clubinhos.
 *
 * O front declara estes mesmos campos em `src/features/clubs/types.ts`. Se um
 * campo entrar ou sair aqui sem entrar ou sair lá, os dois lados divergem sem
 * ninguém perceber até a tela quebrar — este teste força a mudança consciente.
 */
describe('clubs mappers (contrato de resposta)', () => {
  const address = {
    id: 'address-1',
    street: 'Rua A',
    number: '10',
    district: 'Centro',
    city: 'Manaus',
    state: 'AM',
    postalCode: '69000-000',
    complement: 'Casa',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  };

  const user = {
    id: 'user-1',
    name: 'Fulano',
    email: 'fulano@example.com',
    phone: '92999990000',
    active: true,
    completed: true,
    commonUser: false,
  };

  const club = {
    id: 'club-1',
    number: 12,
    weekday: Weekday.SATURDAY,
    time: '14:30:00',
    isActive: true,
    address,
    coordinator: { id: 'coord-1', active: true, user },
    teachers: [{ id: 'teacher-1', active: true, user }],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  } as unknown as ClubEntity;

  const ADDRESS_KEYS = [
    'id',
    'street',
    'number',
    'district',
    'city',
    'state',
    'postalCode',
    'complement',
  ];

  const USER_KEYS = [
    'id',
    'name',
    'email',
    'phone',
    'active',
    'completed',
    'commonUser',
  ];

  it('toClubResponse expõe exatamente os campos do contrato', () => {
    const response = toClubResponse(club);

    expect(Object.keys(response).sort()).toEqual(
      [
        'address',
        'coordinator',
        'createdAt',
        'id',
        'isActive',
        'number',
        'teachers',
        'time',
        'updatedAt',
        'weekday',
      ].sort(),
    );

    expect(Object.keys(response.address ?? {}).sort()).toEqual(
      ADDRESS_KEYS.sort(),
    );
    expect(Object.keys(response.coordinator ?? {}).sort()).toEqual(
      ['id', 'active', 'user'].sort(),
    );
    expect(Object.keys(response.coordinator?.user ?? {}).sort()).toEqual(
      USER_KEYS.sort(),
    );
    expect(Object.keys(response.teachers[0]).sort()).toEqual(
      ['id', 'active', 'user'].sort(),
    );
  });

  it('toClubSimpleResponse não carrega vínculos', () => {
    expect(Object.keys(toClubSimpleResponse(club)).sort()).toEqual(
      [
        'address',
        'createdAt',
        'id',
        'isActive',
        'number',
        'time',
        'updatedAt',
        'weekday',
      ].sort(),
    );
  });

  it('toClubSelectOption entrega id, rótulo e presença de coordenador', () => {
    const option = toClubSelectOption(club);

    expect(Object.keys(option).sort()).toEqual(
      ['coordinator', 'id', 'label'].sort(),
    );
    expect(option.label).toBe('Clubinho 12 : Centro');
    expect(option.coordinator).toBe(true);
  });

  it('corta os segundos do horário e aceita clubinho sem endereço', () => {
    expect(toClubResponse(club).time).toBe('14:30');

    const semEndereco = {
      ...club,
      address: null,
      coordinator: null,
      teachers: [],
    } as unknown as ClubEntity;
    const response = toClubResponse(semEndereco);

    expect(response.address).toBeNull();
    expect(response.coordinator).toBeNull();
    expect(response.teachers).toEqual([]);
  });

  it('usa o traço quando o clubinho não tem bairro', () => {
    const semBairro = {
      ...club,
      address: { ...address, district: '' },
    } as unknown as ClubEntity;

    expect(toClubSelectOption(semBairro).label).toBe('Clubinho 12 : —');
  });
});
