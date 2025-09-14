import { AcceptedChristShortDto } from "src/modules/accepted-christs/dtos/accepted-christ-short.dto";

export class ChildListItemDto {
  id: string;
  name: string;
  guardianName: string;
  gender: string;
  guardianPhone: string;
  clubId?: string | null;
  acceptedChrists?: AcceptedChristShortDto[];
}

export class AddressResponseDto {
  id: string;
  street: string;
  number?: string;
  district: string;
  city: string;
  state: string;
  postalCode: string;
  complement?: string;
}

export class ChildResponseDto {
  id: string;
  name: string;
  birthDate: string;
  guardianName: string;
  gender: string;
  guardianPhone: string;
  joinedAt?: string | null;
  club?: { id: string; number: number; weekday: string } | null;
  address?: AddressResponseDto | null;
  createdAt: string;
  updatedAt: string;
}

export class PaginatedResponseDto<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    orderBy?: string;
    order?: 'ASC' | 'DESC';
  };
}
