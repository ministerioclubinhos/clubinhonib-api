// src/modules/children/mappers/child.mapper.ts
import { ChildEntity } from '../entities/child.entity';
import {
  AddressResponseDto,
  ChildListItemDto,
  ChildResponseDto,
} from '../dto/child-response.dto';

/** Normaliza Date|string|null de campos DATE para 'YYYY-MM-DD' | null */
const dateOnly = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;

  // Já no formato correto?
  const s = String(v).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (m) return m[1];

  // Se for Date válido, extrai a parte da data
  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }

  // Tentar converter string livre para Date
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

/** Normaliza Date|string para ISO completo (UTC) */
const toIsoDateTime = (v: unknown): string => {
  // Se já for ISO, confia
  const s = String(v);
  if (/\d{4}-\d{2}-\d{2}T/.test(s)) return s;
  const d = v instanceof Date ? v : new Date(s);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

export const toChildListItemDto = (e: ChildEntity): ChildListItemDto => ({
  id: (e as any).id,
  name: e.name,
  guardianName: e.guardianName,
  gender: e.gender,
  guardianPhone: e.guardianPhone,
  clubId: (e as any).club?.id ?? null,
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
  birthDate: dateOnly((e as any).birthDate)!,  // 'YYYY-MM-DD'
  guardianName: e.guardianName,
  gender: e.gender,
  guardianPhone: e.guardianPhone,
  joinedAt: dateOnly((e as any).joinedAt),     // 'YYYY-MM-DD' | null
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
