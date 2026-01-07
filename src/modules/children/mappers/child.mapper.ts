import { ChildEntity } from '../entities/child.entity';
import {
  AddressResponseDto,
  ChildListItemDto,
  ChildResponseDto,
} from '../dto/child-response.dto';
import { AcceptedChristShortDto } from 'src/modules/accepted-christs/dtos/accepted-christ-short.dto';

const dateOnly = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;

  let s: string;
  if (typeof v === 'string') {
    s = v.trim();
  } else if (v instanceof Date) {
    s = v.toISOString();
  } else if (typeof v === 'number' || typeof v === 'boolean') {
    s = String(v).trim();
  } else {
    return null;
  }
  const m = s.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (m) return m[1];

  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

const toIsoDateTime = (v: unknown): string => {
  if (v instanceof Date) {
    return isNaN(v.getTime()) ? new Date().toISOString() : v.toISOString();
  }
  if (typeof v === 'string') {
    if (/\d{4}-\d{2}-\d{2}T/.test(v)) return v;
    const d = new Date(v);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
  return new Date().toISOString();
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
  a: {
    id: string;
    street: string;
    number?: string | null;
    district: string;
    city: string;
    state: string;
    postalCode: string;
    complement?: string | null;
  } | null,
): AddressResponseDto | null => {
  if (!a) return null;
  return {
    id: a.id,
    street: a.street,
    number: a.number ?? undefined,
    district: a.district,
    city: a.city,
    state: a.state,
    postalCode: a.postalCode,
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
  address: toAddressDto(e.address ?? null),
  createdAt: toIsoDateTime(e.createdAt),
  updatedAt: toIsoDateTime(e.updatedAt),
});
