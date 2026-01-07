import { Injectable } from '@nestjs/common';

@Injectable()
export class StatisticsCalculationsService {
  calculateAge(birthDate: string): number {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }
    return age;
  }

  getAgeGroup(age: number): string {
    if (age <= 5) return '0-5';
    if (age <= 10) return '6-10';
    if (age <= 15) return '11-15';
    return '16+';
  }

  calculateMonthsParticipating(joinedAt: string | null | undefined): number {
    if (!joinedAt) return 0;
    const joined = new Date(joinedAt);
    const today = new Date();
    const months =
      (today.getFullYear() - joined.getFullYear()) * 12 +
      (today.getMonth() - joined.getMonth());
    return Math.max(0, months);
  }

  getParticipationTimeRange(months: number): string {
    if (months < 3) return '0-3 meses';
    if (months < 6) return '3-6 meses';
    if (months < 12) return '6-12 meses';
    return '1+ ano';
  }
}
