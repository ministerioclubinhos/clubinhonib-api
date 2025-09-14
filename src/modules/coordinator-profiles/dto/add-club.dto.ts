import { IsUUID } from 'class-validator';

export class AssignClubDto {
  @IsUUID()
  clubId!: string;
}

export class UnassignClubDto {
  @IsUUID()
  clubId!: string;
}

export class MoveClubDto {
  @IsUUID()
  clubId!: string;

  @IsUUID()
  toCoordinatorProfileId!: string;
}
