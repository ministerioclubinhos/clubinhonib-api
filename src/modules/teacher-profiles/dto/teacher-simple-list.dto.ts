import { Exclude, Expose, Transform, plainToInstance } from 'class-transformer';
import { TeacherProfileEntity } from '../entities/teacher-profile.entity/teacher-profile.entity';

@Exclude()
export class TeacherSimpleListDto {
  @Expose()
  @Transform(({ obj }) => obj.id)
  teacherProfileId!: string;

  @Expose()
  @Transform(({ obj }) => obj.user?.name || obj.user?.email || '—')
  name!: string;

  @Expose()
  @Transform(({ obj }) => !!obj.club)
  vinculado!: boolean;
}

export const toTeacherSimple = (entity: TeacherProfileEntity): TeacherSimpleListDto =>
  plainToInstance(TeacherSimpleListDto, entity, { excludeExtraneousValues: true });
