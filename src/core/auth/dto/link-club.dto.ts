import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class LinkClubDto {
  @Type(() => Number)
  @IsInt({ message: 'O número do clubinho deve ser um inteiro.' })
  @Min(1, { message: 'O número do clubinho deve ser maior que zero.' })
  clubNumber: number;
}
