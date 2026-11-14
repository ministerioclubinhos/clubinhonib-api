import { RecordAuthorDto } from 'src/shared/record-author/record-author.dto';
import { AcceptedChristShortDto } from 'src/modules/accepted-christs/dtos/accepted-christ-short.dto';

import { ChildSortField, SortOrder } from '../constants';
import { Gender } from '../entities/gender.enum';

/** Clubinho no recorte que a listagem de crianças mostra. */
export class ChildClubDto {
  id: string;
  number: number;
  weekday: string;
}

/** Endereço no contrato de resposta. */
export class AddressResponseDto {
  id: string;
  street: string;
  number: string | null;
  district: string;
  city: string;
  state: string;
  postalCode: string;
  complement: string | null;
}

/** Criança no formato enxuto usado pelos seletores. */
export class ChildListItemDto {
  id: string;
  name: string;
  guardianName: string;
  gender: Gender;
  guardianPhone: string;
  isActive: boolean;
  clubId: string | null;
  acceptedChrists: AcceptedChristShortDto[];
}

/** Criança no contrato completo. */
export class ChildResponseDto {
  id: string;
  name: string;
  /** `YYYY-MM-DD`. */
  birthDate: string;
  guardianName: string;
  gender: Gender;
  guardianPhone: string;
  /** `YYYY-MM-DD`, ou `null` quando não informado. */
  joinedAt: string | null;
  isActive: boolean;
  club: ChildClubDto | null;
  address: AddressResponseDto | null;
  /** Quem cadastrou; `null` em cadastros antigos. */
  createdBy: RecordAuthorDto | null;
  /** Quem alterou por último (edição, ativar ou desativar). */
  updatedBy: RecordAuthorDto | null;
  createdAt: string;
  updatedAt: string;
}

/** Metadados da paginação das listagens de crianças. */
export class ChildrenPageMetaDto {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  orderBy: ChildSortField;
  order: SortOrder;
}

export class PaginatedResponseDto<T> {
  data: T[];
  meta: ChildrenPageMetaDto;
}
