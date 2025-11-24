import { Injectable } from '@nestjs/common';
import { ClubExceptionEntity } from '../entities/club-exception.entity';

@Injectable()
export class ClubStatusService {
  determineStatus(
    hasException: boolean,
    isFutureWeek: boolean,
    hasPassedClubDay: boolean,
    isCurrentWeek: boolean,
    childrenWithPagela: number,
    totalChildren: number,
  ): string {
    if (hasException) {
      return 'exception';
    }

    if (isFutureWeek) {
      if (childrenWithPagela === totalChildren && totalChildren > 0) {
        return 'ok';
      } else if (childrenWithPagela > 0) {
        return 'partial';
      } else {
        return 'pending';
      }
    }

    if (!hasPassedClubDay && isCurrentWeek) {
      if (childrenWithPagela === totalChildren && totalChildren > 0) {
        return 'ok';
      } else {
        return 'pending';
      }
    }

    if (childrenWithPagela === totalChildren) {
      return 'ok';
    } else if (childrenWithPagela > 0) {
      return 'partial';
    } else {
      return 'missing';
    }
  }
}
