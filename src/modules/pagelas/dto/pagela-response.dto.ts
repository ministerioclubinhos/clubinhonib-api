import { PagelaEntity } from '../entities/pagela.entity';

export class PagelaResponseDto {
  id: string;
  createdAt: string;
  updatedAt: string;

  childId: string;
  teacherProfileId: string | null;

  referenceDate: string;
  year: number;
  week: number;

  present: boolean;
  didMeditation: boolean;
  recitedVerse: boolean;
  notes: string | null;

  static fromEntity(e: PagelaEntity): PagelaResponseDto {
    const createdAt =
      e.createdAt instanceof Date
        ? e.createdAt.toISOString()
        : String(e.createdAt);
    const updatedAt =
      e.updatedAt instanceof Date
        ? e.updatedAt.toISOString()
        : String(e.updatedAt);
    return {
      id: e.id,
      createdAt,
      updatedAt,
      childId: e.child?.id,
      teacherProfileId: e.teacher?.id ?? null,
      referenceDate: e.referenceDate,
      year: e.year,
      week: e.week,
      present: e.present,
      didMeditation: e.didMeditation,
      recitedVerse: e.recitedVerse,
      notes: e.notes ?? null,
    };
  }
}
