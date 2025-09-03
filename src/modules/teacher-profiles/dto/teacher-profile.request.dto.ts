// src/modules/teacher-profiles/dto/teacher-profile.request.dto.ts
import { IsOptional, IsUUID } from 'class-validator';

export class AssignTeacherToClubDto {
  @IsUUID()
  clubId!: string;
}

export class UnassignTeacherFromClubDto {
  // opcional: enviar o clubId esperado para checar consistência
  @IsOptional()
  @IsUUID()
  clubId?: string;
}
