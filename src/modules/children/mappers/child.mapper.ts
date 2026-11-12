import { toRecordAuthor } from 'src/shared/record-author/record-author.util';
import { AddressEntity } from 'src/modules/addresses/entities/address.entity/address.entity';
import { toAcceptedChristShort } from 'src/modules/accepted-christs/mappers';

import {
  AddressResponseDto,
  ChildClubDto,
  ChildListItemDto,
  ChildResponseDto,
} from '../dto/child-response.dto';
import { ChildEntity } from '../entities/child.entity';
import { Gender } from '../entities/gender.enum';
import { toDateOnly, toIsoDateTime } from '../utils';

/**
 * Sexo gravado na coluna textual.
 *
 * Cadastros anteriores à validação podem trazer outro texto; nesse caso o
 * contrato devolve masculino, que é o padrão histórico do formulário.
 */
const toGender = (value: string): Gender =>
  value === (Gender.FEMALE as string) ? Gender.FEMALE : Gender.MALE;

const toClub = (entity: ChildEntity): ChildClubDto | null =>
  entity.club
    ? {
        id: entity.club.id,
        number: entity.club.number,
        weekday: String(entity.club.weekday),
      }
    : null;

export const toAddressDto = (
  address: AddressEntity | null | undefined,
): AddressResponseDto | null => {
  if (!address) return null;

  return {
    id: address.id,
    street: address.street ?? '',
    number: address.number ?? null,
    district: address.district ?? '',
    city: address.city ?? '',
    state: address.state ?? '',
    postalCode: address.postalCode ?? '',
    complement: address.complement ?? null,
  };
};

export const toChildListItemDto = (entity: ChildEntity): ChildListItemDto => ({
  id: entity.id,
  name: entity.name,
  guardianName: entity.guardianName,
  gender: toGender(entity.gender),
  guardianPhone: entity.guardianPhone,
  isActive: entity.isActive,
  clubId: entity.club?.id ?? null,
  // O recorte curto é montado pelo módulo dono da decisão, num lugar só.
  acceptedChrists: (entity.acceptedChrists ?? []).map(toAcceptedChristShort),
});

export const toChildResponseDto = (entity: ChildEntity): ChildResponseDto => ({
  id: entity.id,
  name: entity.name,
  birthDate: toDateOnly(entity.birthDate) ?? '',
  guardianName: entity.guardianName,
  gender: toGender(entity.gender),
  guardianPhone: entity.guardianPhone,
  joinedAt: toDateOnly(entity.joinedAt),
  isActive: entity.isActive,
  club: toClub(entity),
  address: toAddressDto(entity.address),
  createdBy: toRecordAuthor(entity.createdBy),
  updatedBy: toRecordAuthor(entity.updatedBy),
  createdAt: toIsoDateTime(entity.createdAt),
  updatedAt: toIsoDateTime(entity.updatedAt),
});
