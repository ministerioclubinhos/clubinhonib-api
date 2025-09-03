// src/modules/clubs/dto/club.response.dto.ts
import { Exclude, Expose, Type, Transform, plainToInstance } from 'class-transformer';
import { AddressResponseDto } from 'src/modules/addresses/dto/address.response.dto';
import { Weekday } from '../enums/weekday.enum/weekday.enum';
import { ClubEntity } from '../entities/club.entity/club.entity';

/** User “mini” seguro (sem password/refreshToken) */
@Exclude()
class UserMiniDto {
  @Expose() id!: string;
  @Expose() name!: string;
  @Expose() email!: string;
  @Expose() phone!: string;
  @Expose() active!: boolean;
  @Expose() completed!: boolean;
  @Expose() commonUser!: boolean;
  // @Expose() role!: string; // habilite se quiser retornar role
}

/** Coordinator com user aninhado */
@Exclude()
class CoordinatorWithUserDto {
  @Expose() id!: string;
  @Expose() active!: boolean;

  @Expose()
  @Type(() => UserMiniDto)
  user!: UserMiniDto;
}

/** Teacher com user aninhado */
@Exclude()
class TeacherWithUserDto {
  @Expose() id!: string;
  @Expose() active!: boolean;

  @Expose()
  @Type(() => UserMiniDto)
  user!: UserMiniDto;
}

@Exclude()
export class ClubMiniDto {
  @Expose() id!: string;
  @Expose() number!: number;
  @Expose() weekday!: Weekday;
}

@Exclude()
export class ClubSimpleResponseDto {
  @Expose() id!: string;
  @Expose() number!: number;
  @Expose() weekday!: Weekday;

  @Expose()
  @Type(() => AddressResponseDto)
  address!: AddressResponseDto;

  @Expose() createdAt!: Date;
  @Expose() updatedAt!: Date;
}

@Exclude()
export class ClubResponseDto {
  @Expose() id!: string;
  @Expose() number!: number;

  @Expose()
  @Type(() => AddressResponseDto)
  address!: AddressResponseDto;

  @Expose()
  @Type(() => CoordinatorWithUserDto)
  @Transform(({ value }) => value ?? null)
  coordinator!: CoordinatorWithUserDto | null;

  @Expose()
  @Type(() => TeacherWithUserDto)
  @Transform(({ value }) => (Array.isArray(value) ? value : []))
  teachers!: TeacherWithUserDto[];

  @Expose() weekday!: Weekday;
  @Expose() createdAt!: Date;
  @Expose() updatedAt!: Date;
}

/** Helpers opcionais para usar nos services */
export function toClubSimpleDto(entity: ClubEntity): ClubSimpleResponseDto {
  return plainToInstance(ClubSimpleResponseDto, entity, { excludeExtraneousValues: true });
}
export function toClubDto(entity: ClubEntity): ClubResponseDto {
  return plainToInstance(ClubResponseDto, entity, { excludeExtraneousValues: true });
}
