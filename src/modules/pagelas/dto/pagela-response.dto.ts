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
    return {
      id: e.id,
      createdAt: (e as any).createdAt?.toISOString?.() ?? (e as any).createdAt,
      updatedAt: (e as any).updatedAt?.toISOString?.() ?? (e as any).updatedAt,
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
