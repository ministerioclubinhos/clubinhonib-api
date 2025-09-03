// src/modules/coordinator-profiles/dto/create-coordinator-profile.dto.ts
import { IsUUID } from 'class-validator';

export class CreateCoordinatorProfileDto {
  @IsUUID()
  userId!: string;
}
