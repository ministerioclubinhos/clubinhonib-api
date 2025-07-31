import { Exclude, Expose, Type, Transform, plainToInstance } from 'class-transformer';
import { Weekday } from 'src/modules/clubs/enums/weekday.enum/weekday.enum';
import { TeacherProfileEntity } from '../entities/teacher-profile.entity/teacher-profile.entity';

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

/** ✅ Teacher mini exportado, agora com user */
@Exclude()
export class TeacherMiniDto {
  @Expose() id!: string;
  @Expose() active!: boolean;

  @Expose()
  @Type(() => UserMiniDto)
  user!: UserMiniDto;
}

/** Coordinator mini com user (para aparecer dentro do club) */
@Exclude()
export class CoordinatorMiniDto {
  @Expose() id!: string;
  @Expose() active!: boolean;

  @Expose()
  @Type(() => UserMiniDto)
  user!: UserMiniDto;
}

/** Club do teacher, contendo o coordinator (com user) */
@Exclude()
export class ClubMiniWithCoordinatorDto {
  @Expose() id!: string;
  @Expose() number!: number;
  @Expose() weekday!: Weekday;

  @Expose()
  @Type(() => CoordinatorMiniDto)
  @Transform(({ value }) => value ?? null)
  coordinator!: CoordinatorMiniDto | null;
}

/** Resposta completa do Teacher (com seu user + club[coordinator[user]]) */
@Exclude()
export class TeacherResponseDto {
  @Expose() id!: string;
  @Expose() active!: boolean;

  @Expose()
  @Type(() => UserMiniDto)
  user!: UserMiniDto;

  @Expose()
  @Type(() => ClubMiniWithCoordinatorDto)
  @Transform(({ value }) => value ?? null)
  club!: ClubMiniWithCoordinatorDto | null;
}

export function toTeacherDto(entity: TeacherProfileEntity): TeacherResponseDto {
  return plainToInstance(TeacherResponseDto, entity, { excludeExtraneousValues: true });
}
