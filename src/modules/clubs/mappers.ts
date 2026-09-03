import { ClubEntity } from './entities/club.entity';
import { CoordinatorProfileEntity } from 'src/modules/coordinator-profiles/entities/coordinator-profile.entity/coordinator-profile.entity';
import { TeacherProfileEntity } from 'src/modules/teacher-profiles/entities/teacher-profile.entity/teacher-profile.entity';
import { UserEntity } from 'src/core/user/entities/user.entity';
import {
  ClubAddressResponseDto,
  ClubResponseDto,
  ClubSimpleResponseDto,
  ClubUserMiniDto,
  CoordinatorWithUserDto,
  TeacherWithUserDto,
} from './dto/club.response.dto';
import { ClubSelectOptionDto } from './dto/club-select-option.dto';
import { formatClubOptionLabel, toDisplayTime } from './utils';

/** Endereço no contrato público. */
function toAddressResponse(
  address: ClubEntity['address'],
): ClubAddressResponseDto | null {
  if (!address) return null;

  // Toda coluna do endereço é anulável no banco. Devolver `null` em vez de
  // omitir a chave mantém o formato previsível para quem consome.
  return {
    id: address.id,
    street: address.street ?? null,
    number: address.number ?? null,
    district: address.district ?? null,
    city: address.city ?? null,
    state: address.state ?? null,
    postalCode: address.postalCode ?? null,
    complement: address.complement ?? null,
  };
}

/** Dados mínimos do usuário ligado a um perfil. */
function toUserMini(user: UserEntity): ClubUserMiniDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    active: user.active,
    completed: user.completed,
    commonUser: user.commonUser,
  };
}

function toCoordinator(
  coordinator: CoordinatorProfileEntity | null,
): CoordinatorWithUserDto | null {
  if (!coordinator) return null;

  return {
    id: coordinator.id,
    active: coordinator.active,
    user: coordinator.user ? toUserMini(coordinator.user) : null,
  };
}

function toTeacher(teacher: TeacherProfileEntity): TeacherWithUserDto {
  return {
    id: teacher.id,
    active: teacher.active,
    user: teacher.user ? toUserMini(teacher.user) : null,
  };
}

/** Clubinho completo, com endereço, coordenador e professores. */
export function toClubResponse(club: ClubEntity): ClubResponseDto {
  return {
    id: club.id,
    number: club.number,
    weekday: club.weekday,
    time: toDisplayTime(club.time),
    isActive: club.isActive,
    address: toAddressResponse(club.address),
    coordinator: toCoordinator(club.coordinator ?? null),
    teachers: (club.teachers ?? []).map(toTeacher),
    createdAt: club.createdAt,
    updatedAt: club.updatedAt,
  };
}

/** Clubinho sem os vínculos, para listas leves. */
export function toClubSimpleResponse(club: ClubEntity): ClubSimpleResponseDto {
  return {
    id: club.id,
    number: club.number,
    weekday: club.weekday,
    time: toDisplayTime(club.time),
    isActive: club.isActive,
    address: toAddressResponse(club.address),
    createdAt: club.createdAt,
    updatedAt: club.updatedAt,
  };
}

/** Opção de seleção usada nos formulários. */
export function toClubSelectOption(club: ClubEntity): ClubSelectOptionDto {
  return {
    id: club.id,
    label: formatClubOptionLabel(club.number, club.address?.district),
    coordinator: Boolean(club.coordinator),
  };
}
