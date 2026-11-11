import { HttpStatus, Injectable, MessageEvent } from '@nestjs/common';
import {
  Observable,
  defer,
  exhaustMap,
  finalize,
  from,
  interval,
  map,
  startWith,
  take,
} from 'rxjs';
import { AppException, ErrorCode } from 'src/shared/exceptions';
import { LESSON_EVENT_STREAM } from '../constants/lesson-workflow.constants';
import { toLessonResponse } from '../dto/lesson-response.dto';
import { LessonView } from '../enums/lesson-failure-code.enum';
import { LessonDraftService } from './lesson-draft.service';

/**
 * Server-sent snapshots of one lesson. Each tick costs a light digest query;
 * the full graph is loaded only when the digest changes. Connections are
 * capped per user and lesson so forgotten tabs cannot pile up polling.
 */
@Injectable()
export class LessonEventStreamService {
  private readonly connections = new Map<string, number>();

  constructor(private readonly lessons: LessonDraftService) {}

  stream(
    lessonId: string,
    userId: string,
    view: LessonView = LessonView.FULL,
  ): Observable<MessageEvent> {
    return defer(() => {
      const release = this.acquire(`${userId}:${lessonId}`);
      let lastDigest: string | null = null;
      return interval(LESSON_EVENT_STREAM.TICK_MS).pipe(
        startWith(0),
        take(LESSON_EVENT_STREAM.MAX_TICKS_PER_CONNECTION),
        // A tick that arrives while the previous one is still querying is
        // dropped instead of stacking queries on a slow database.
        exhaustMap(() => from(this.nextEvent(lessonId, view, lastDigest))),
        map(({ digest, event }) => {
          lastDigest = digest;
          return event;
        }),
        finalize(release),
      );
    });
  }

  private async nextEvent(
    lessonId: string,
    view: LessonView,
    lastDigest: string | null,
  ): Promise<{ digest: string; event: MessageEvent }> {
    const digest = await this.lessons.getEventDigest(lessonId);
    if (digest === lastDigest)
      return {
        digest,
        event: {
          type: 'heartbeat',
          data: { type: 'heartbeat', timestamp: new Date().toISOString() },
        },
      };
    const lesson = await this.lessons.getById(lessonId);
    return { digest, event: { data: toLessonResponse(lesson, { view }) } };
  }

  private acquire(key: string): () => void {
    const current = this.connections.get(key) ?? 0;
    if (current >= LESSON_EVENT_STREAM.MAX_CONNECTIONS_PER_USER_AND_LESSON)
      throw new AppException(
        ErrorCode.LESSON_EVENT_STREAM_LIMIT,
        'Há muitas telas acompanhando esta lição ao mesmo tempo. Feche as abas que não estiver usando.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    this.connections.set(key, current + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const remaining = (this.connections.get(key) ?? 1) - 1;
      if (remaining > 0) this.connections.set(key, remaining);
      else this.connections.delete(key);
    };
  }
}
