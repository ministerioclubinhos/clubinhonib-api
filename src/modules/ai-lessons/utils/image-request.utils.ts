import {
  IMAGE_REQUEST_RETRY_DELAY_MS,
  IMAGE_TRANSIENT_CONNECTION_CODES,
} from '../constants/image-request.constants';

export function imageConnectionErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const value = error as { code?: unknown; cause?: unknown };
  const code = typeof value.code === 'string' ? value.code : '';
  if (IMAGE_TRANSIENT_CONNECTION_CODES.some((candidate) => candidate === code))
    return code;
  if (value.cause && typeof value.cause === 'object') {
    const causeCode = (value.cause as { code?: unknown }).code;
    if (
      typeof causeCode === 'string' &&
      IMAGE_TRANSIENT_CONNECTION_CODES.some(
        (candidate) => candidate === causeCode,
      )
    )
      return causeCode;
  }
  return null;
}

/** One bounded retry of the same image; never restart the stage or retry billing errors. */
export async function retryImageConnection<T>(
  request: () => Promise<T>,
  onRetry: (code: string) => void,
): Promise<T> {
  try {
    return await request();
  } catch (error: unknown) {
    const code = imageConnectionErrorCode(error);
    if (!code) throw error;
    onRetry(code);
    await new Promise<void>((resolve) =>
      setTimeout(resolve, IMAGE_REQUEST_RETRY_DELAY_MS),
    );
    return request();
  }
}
