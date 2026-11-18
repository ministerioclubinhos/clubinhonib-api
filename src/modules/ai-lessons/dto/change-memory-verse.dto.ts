import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { LESSON_VERSE_CHANGE } from '../constants/lesson-verse-change.constants';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Body of `PATCH /lessons/:id/memory-verse`: only the verse changes; the version is always NVI. */
export class ChangeMemoryVerseRequestDto {
  @Transform(trimString)
  @IsString()
  @MinLength(LESSON_VERSE_CHANGE.TEXT_MIN_LENGTH)
  @MaxLength(LESSON_VERSE_CHANGE.TEXT_MAX_LENGTH)
  text: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(LESSON_VERSE_CHANGE.REFERENCE_MAX_LENGTH)
  reference: string;

  /** `lockVersion` of item 1 the admin was looking at. */
  @IsInt()
  lockVersion: number;

  /**
   * The admin confirmed that item 1 goes back to production and that the
   * items already generated after it become outdated.
   */
  @IsOptional()
  @IsBoolean()
  acknowledgeImpact?: boolean;
}
