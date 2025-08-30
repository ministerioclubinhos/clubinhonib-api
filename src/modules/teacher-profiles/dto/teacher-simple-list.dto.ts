// src/modules/teacher-profiles/dto/teacher-simple-list.dto.ts
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

  /** true se já está vinculado a algum club (teacherProfile.club != null) */
  @Expose()
  @Transform(({ obj }) => !!obj.club)
  vinculado!: boolean;
}

/** ✅ Respeita Exclude/Expose/Transform e não vaza outros campos */
export const toTeacherSimple = (entity: TeacherProfileEntity): TeacherSimpleListDto =>
  plainToInstance(TeacherSimpleListDto, entity, { excludeExtraneousValues: true });
