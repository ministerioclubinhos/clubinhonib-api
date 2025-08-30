import { Exclude, Expose, Type, Transform, plainToInstance } from 'class-transformer';
import { Weekday } from 'src/modules/clubs/enums/weekday.enum/weekday.enum';
import { CoordinatorProfileEntity } from '../entities/coordinator-profile.entity/coordinator-profile.entity';

/** Mini do User (sem campos sensíveis) */
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

/** Teacher “mini” com user aninhado (mantém o nome exportado) */
@Exclude()
export class TeacherMiniDto {
  @Expose() id!: string;
  @Expose() active!: boolean;

  @Expose()
  @Type(() => UserMiniDto)
  user!: UserMiniDto;
}

/** Club com lista de teachers (cada teacher com user) */
@Exclude()
export class ClubWithTeachersDto {
  @Expose() id!: string;
  @Expose() number!: number;
  @Expose() weekday!: Weekday;

  @Expose()
  @Type(() => TeacherMiniDto)
  @Transform(({ value }) => (Array.isArray(value) ? value : []))
  teachers!: TeacherMiniDto[];
}

/** Coordinator “mini” com user (mantém o nome exportado) */
@Exclude()
export class CoordinatorMiniDto {
  @Expose() id!: string;
  @Expose() active!: boolean;

  @Expose()
  @Type(() => UserMiniDto)
  user!: UserMiniDto;
}

/** Resposta completa do Coordinator (com user + clubs + teachers[user]) */
@Exclude()
export class CoordinatorResponseDto {
  @Expose() id!: string;
  @Expose() active!: boolean;

  @Expose()
  @Type(() => UserMiniDto)
  user!: UserMiniDto;

  @Expose()
  @Type(() => ClubWithTeachersDto)
  @Transform(({ value }) => (Array.isArray(value) ? value : []))
  clubs!: ClubWithTeachersDto[];
}

/* Helpers */
export function toCoordinatorDto(entity: CoordinatorProfileEntity): CoordinatorResponseDto {
  return plainToInstance(CoordinatorResponseDto, entity, { excludeExtraneousValues: true });
}
export function toCoordinatorMini(entity: CoordinatorProfileEntity): CoordinatorMiniDto {
  return plainToInstance(CoordinatorMiniDto, entity, { excludeExtraneousValues: true });
}
