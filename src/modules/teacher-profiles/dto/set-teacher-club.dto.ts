// src/modules/teacher-profiles/dto/set-teacher-club.dto.ts
import { IsInt, Min } from 'class-validator';

export class SetTeacherClubDto {
  @IsInt()
  @Min(1)
  clubNumber!: number;
}
