import { IsUUID } from 'class-validator';

export class SetTeacherCoordinatorDto {
  @IsUUID()
  coordinatorUserId!: string;
}
