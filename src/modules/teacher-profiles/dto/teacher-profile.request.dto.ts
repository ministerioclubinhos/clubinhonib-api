import { IsOptional, IsUUID } from 'class-validator';

export class AssignTeacherToClubDto {
  @IsUUID()
  clubId!: string;
}

export class UnassignTeacherFromClubDto {
  @IsOptional()
  @IsUUID()
  clubId?: string;
}
