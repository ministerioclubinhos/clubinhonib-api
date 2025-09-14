import { IsUUID } from 'class-validator';

export class CreateCoordinatorProfileDto {
  @IsUUID()
  userId!: string;
}
