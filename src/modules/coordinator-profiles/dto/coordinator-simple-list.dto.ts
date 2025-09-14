import { Exclude, Expose, Transform, plainToInstance } from 'class-transformer';
import { CoordinatorProfileEntity } from '../entities/coordinator-profile.entity/coordinator-profile.entity';

@Exclude()
export class CoordinatorSimpleListDto {
  @Expose()
  @Transform(({ obj }) => obj.id)
  coordinatorProfileId!: string;

  @Expose()
  @Transform(({ obj }) => obj.user?.name)
  name!: string;

  @Expose()
  @Transform(({ obj }) => Array.isArray(obj.clubs) && obj.clubs.length > 0)
  vinculado!: boolean;
}

export const toCoordinatorSimple = (entity: CoordinatorProfileEntity): CoordinatorSimpleListDto =>
  plainToInstance(CoordinatorSimpleListDto, entity, { excludeExtraneousValues: true });
