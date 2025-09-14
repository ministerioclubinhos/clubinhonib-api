import { IsInt, Min } from 'class-validator';

export class SetTeacherClubDto {
  @IsInt()
  @Min(1)
  clubNumber!: number;
}
