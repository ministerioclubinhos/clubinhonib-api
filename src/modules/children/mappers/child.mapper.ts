import { ChildEntity } from '../entities/child.entity';
import { AddressEntity } from 'src/modules/addresses/entities/address.entity/address.entity';
import {
  AddressResponseDto,
  ChildListItemDto,
  ChildResponseDto,
} from '../dto/child-response.dto';
import { AcceptedChristShortDto } from 'src/modules/accepted-christs/dtos/accepted-christ-short.dto';

const dateOnly = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;

  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }

  if (typeof v !== 'string' && typeof v !== 'number') return null;

  const s = String(v).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (m) return m[1];

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

const toIsoDateTime = (v: unknown): string => {
  const s = String(v);
  if (/\d{4}-\d{2}-\d{2}T/.test(s)) return s;
  const d = v instanceof Date ? v : new Date(s);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

export const toChildListItemDto = (e: ChildEntity): ChildListItemDto => ({
  id: e.id,
  name: e.name,
  guardianName: e.guardianName,
  gender: e.gender,
  guardianPhone: e.guardianPhone,
  isActive: e.isActive,
  clubId: e.club?.id ?? null,
  acceptedChrists: (e.acceptedChrists ?? []).map(
    (a): AcceptedChristShortDto => ({
      id: a.id,
      decision: a.decision,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }),
  ),
});

export const toAddressDto = (
  a: AddressEntity | null | undefined,
): AddressResponseDto | null => {
  if (!a) return null;
  return {
    id: a.id,
    street: a.street ?? '',
    number: a.number ?? undefined,
    district: a.district ?? '',
    city: a.city ?? '',
    state: a.state ?? '',
    postalCode: a.postalCode ?? '',
    complement: a.complement ?? undefined,
  };
};

export const toChildResponseDto = (e: ChildEntity): ChildResponseDto => ({
  id: e.id,
  name: e.name,
  birthDate: dateOnly(e.birthDate)!,
  guardianName: e.guardianName,
  gender: e.gender,
  guardianPhone: e.guardianPhone,
  joinedAt: dateOnly(e.joinedAt),
  isActive: e.isActive,
  club: e.club
    ? {
        id: e.club.id,
        number: e.club.number,
        weekday: String(e.club.weekday),
      }
    : null,
  address: toAddressDto(e.address),
  createdAt: toIsoDateTime(e.createdAt),
  updatedAt: toIsoDateTime(e.updatedAt),
});
