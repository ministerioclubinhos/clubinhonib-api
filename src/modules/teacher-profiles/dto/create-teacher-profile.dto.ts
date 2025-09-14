import { IsUUID, IsOptional, IsInt, Min } from 'class-validator';

export class CreateTeacherProfileDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  clubNumber?: number;

  @IsOptional()
  @IsUUID()
  coordinatorUserId?: string;
}
