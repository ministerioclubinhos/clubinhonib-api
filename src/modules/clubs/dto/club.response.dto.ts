import { Exclude, Expose, Type, Transform, plainToInstance } from 'class-transformer';
import { AddressResponseDto } from 'src/modules/addresses/dto/address.response.dto';
import { Weekday } from '../enums/weekday.enum/weekday.enum';
import { ClubEntity } from '../entities/club.entity/club.entity';

@Exclude()
class UserMiniDto {
  @Expose() id!: string;
  @Expose() name!: string;
  @Expose() email!: string;
  @Expose() phone!: string;
  @Expose() active!: boolean;
  @Expose() completed!: boolean;
  @Expose() commonUser!: boolean;
}

@Exclude()
class CoordinatorWithUserDto {
  @Expose() id!: string;
  @Expose() active!: boolean;

  @Expose()
  @Type(() => UserMiniDto)
  user!: UserMiniDto;
}

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

  @Expose()
  @Transform(({ value }) => (typeof value === 'string' ? value.slice(0, 5) : null))
  time!: string | null;
}

@Exclude()
export class ClubSimpleResponseDto {
  @Expose() id!: string;
  @Expose() number!: number;
  @Expose() weekday!: Weekday;

  @Expose()
  @Transform(({ value }) => (typeof value === 'string' ? value.slice(0, 5) : null))
  time!: string | null;

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
  @Transform(({ value }) => (typeof value === 'string' ? value.slice(0, 5) : null))
  time!: string | null;

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

export function toClubSimpleDto(entity: ClubEntity): ClubSimpleResponseDto {
  return plainToInstance(ClubSimpleResponseDto, entity, { excludeExtraneousValues: true });
}
export function toClubDto(entity: ClubEntity): ClubResponseDto {
  return plainToInstance(ClubResponseDto, entity, { excludeExtraneousValues: true });
}
