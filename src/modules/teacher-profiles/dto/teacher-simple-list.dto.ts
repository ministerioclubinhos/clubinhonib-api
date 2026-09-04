import { Exclude, Expose, Transform, plainToInstance } from 'class-transformer';
import { TeacherProfileEntity } from '../entities/teacher-profile.entity/teacher-profile.entity';

@Exclude()
export class TeacherSimpleListDto {
  @Expose()
  @Transform(({ obj }: { obj: TeacherProfileEntity }) => obj.id)
  teacherProfileId!: string;

  @Expose()
  @Transform(
    ({ obj }: { obj: TeacherProfileEntity }) =>
      obj.user?.name || obj.user?.email || '—',
  )
  name!: string;

  @Expose()
  @Transform(({ obj }: { obj: TeacherProfileEntity }) => !!obj.club)
  vinculado!: boolean;

  /**
   * Onde o professor está hoje, ou `null` quando não tem turma.
   *
   * O seletor precisa disto para dizer de onde o professor viria: `vinculado`
   * sozinho só permitia desabilitar a opção, sem explicar o motivo.
   */
  @Expose()
  @Transform(({ obj }: { obj: TeacherProfileEntity }) => obj.club?.id ?? null)
  clubId!: string | null;

  @Expose()
  @Transform(
    ({ obj }: { obj: TeacherProfileEntity }) => obj.club?.number ?? null,
  )
  clubNumber!: number | null;
}

export const toTeacherSimple = (
  entity: TeacherProfileEntity,
): TeacherSimpleListDto =>
  plainToInstance(TeacherSimpleListDto, entity, {
    excludeExtraneousValues: true,
  });
