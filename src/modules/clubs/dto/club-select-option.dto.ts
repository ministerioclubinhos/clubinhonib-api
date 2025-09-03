// src/modules/clubs/dto/club-select-option.dto.ts
import { Exclude, Expose } from 'class-transformer';
import { ClubEntity } from '../entities/club.entity/club.entity';

@Exclude()
export class ClubSelectOptionDto {
  @Expose()
  id!: string;

  @Expose()
  detalhe!: string;

  @Expose()
  coordinator!: boolean;
}

export function toClubSelectOption(entity: ClubEntity): ClubSelectOptionDto {
  const bairro = entity.address?.district?.trim();
  return {
    id: entity.id,
    detalhe: `Clubinho ${entity.number} : ${bairro || '—'}`, // 👈 formato novo
    coordinator: !!entity.coordinator,
  };
}
