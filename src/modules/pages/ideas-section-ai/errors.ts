import { IdeaAiErrorCode } from './enums/ideas-section-ai.enums';

/** Stops an attempt early with a specific (often uncounted) error code. */
export class IdeaAiAbort extends Error {
  constructor(readonly code: IdeaAiErrorCode) {
    super(code);
  }
}
