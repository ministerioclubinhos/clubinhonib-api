// src/modules/teacher-profiles/dto/set-teacher-coordinator.dto.ts
import { IsUUID } from 'class-validator';

export class SetTeacherCoordinatorDto {
  @IsUUID()
  coordinatorUserId!: string;
}
