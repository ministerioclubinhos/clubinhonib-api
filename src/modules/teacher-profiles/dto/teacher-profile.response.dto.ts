import { Exclude, Expose, Type, Transform, plainToInstance } from 'class-transformer';
import { Weekday } from 'src/modules/clubs/enums/weekday.enum/weekday.enum';
import { TeacherProfileEntity } from '../entities/teacher-profile.entity/teacher-profile.entity';

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
export class TeacherMiniDto {
  @Expose() id!: string;
  @Expose() active!: boolean;

  @Expose()
  @Type(() => UserMiniDto)
  user!: UserMiniDto;
}

@Exclude()
export class CoordinatorMiniDto {
  @Expose() id!: string;
  @Expose() active!: boolean;

  @Expose()
  @Type(() => UserMiniDto)
  user!: UserMiniDto;
}

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

  @Expose() createdAt!: Date;
  @Expose() updatedAt!: Date;
}

export function toTeacherDto(entity: TeacherProfileEntity): TeacherResponseDto {
  return plainToInstance(TeacherResponseDto, entity, { excludeExtraneousValues: true });
}
