import { CompleteProfileResponseDto } from './complete-profile-response.dto';

export class PaginationMetaDto {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export class PaginatedProfilesResponseDto {
  items: CompleteProfileResponseDto[];
  meta: PaginationMetaDto;
}
