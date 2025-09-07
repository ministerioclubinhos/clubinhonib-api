import { ChildEntity } from '../entities/child.entity';
import {
  AddressResponseDto,
  ChildListItemDto,
  ChildResponseDto,
} from '../dto/child-response.dto';
import { AcceptedChristShortDto } from 'src/modules/accepted-christs/dtos/accepted-christ-short.dto';

const dateOnly = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;

  const s = String(v).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (m) return m[1];

  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }

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
  clubId: e.club?.id ?? null,
  acceptedChrists: (e.acceptedChrists ?? []).map((a): AcceptedChristShortDto => ({
    id: a.id,
    decision: a.decision,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  })),
});

export const toAddressDto = (a: any): AddressResponseDto | null => {
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
  id: (e as any).id,
  name: e.name,
  birthDate: dateOnly((e as any).birthDate)!,
  guardianName: e.guardianName,
  gender: e.gender,
  guardianPhone: e.guardianPhone,
  joinedAt: dateOnly((e as any).joinedAt),
  club: (e as any).club
    ? {
      id: (e as any).club.id,
      number: (e as any).club.number,
      weekday: String((e as any).club.weekday),
    }
    : null,
  address: toAddressDto((e as any).address),
  createdAt: toIsoDateTime((e as any).createdAt),
  updatedAt: toIsoDateTime((e as any).updatedAt),
});
