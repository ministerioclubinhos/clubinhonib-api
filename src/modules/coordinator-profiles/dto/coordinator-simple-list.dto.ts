// src/modules/coordinator-profiles/dto/coordinator-simple-list.dto.ts
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

  /** true se já está vinculado a algum club (existem clubs com este coordinator) */
  @Expose()
  @Transform(({ obj }) => Array.isArray(obj.clubs) && obj.clubs.length > 0)
  vinculado!: boolean;
}

// ✅ Use class-transformer corretamente para respeitar Exclude/Expose/Transform
export const toCoordinatorSimple = (entity: CoordinatorProfileEntity): CoordinatorSimpleListDto =>
  plainToInstance(CoordinatorSimpleListDto, entity, { excludeExtraneousValues: true });
