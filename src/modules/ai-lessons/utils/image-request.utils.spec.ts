import {
  imageConnectionErrorCode,
  retryImageConnection,
} from './image-request.utils';

describe('image connection retry', () => {
  afterEach(() => jest.useRealTimers());
  it('retries only the interrupted image once', async () => {
    jest.useFakeTimers();
    const request = jest
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }),
      )
      .mockResolvedValueOnce(Buffer.from('image'));
    const log = jest.fn();
    const result = retryImageConnection<Buffer>(request, log);
    await jest.runAllTimersAsync();
    expect((await result).toString()).toBe('image');
    expect(request).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith('ECONNRESET');
  });
  it('stops after the second network failure', async () => {
    jest.useFakeTimers();
    const error = { code: 'ECONNRESET' };
    const request = jest.fn().mockRejectedValue(error);
    const result = expect(
      retryImageConnection(request, jest.fn()),
    ).rejects.toBe(error);
    await jest.runAllTimersAsync();
    await result;
    expect(request).toHaveBeenCalledTimes(2);
  });
  it.each([
    { response: { status: 400 } },
    { response: { status: 401 } },
    { response: { status: 429 } },
    { code: 'ECONNABORTED' },
  ])(
    'does not repeat invalid, billing or timeout requests: %j',
    async (error) => {
      const request = jest.fn().mockRejectedValue(error);
      await expect(retryImageConnection(request, jest.fn())).rejects.toBe(
        error,
      );
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
  it('recognizes the original socket cause', () => {
    expect(imageConnectionErrorCode({ cause: { code: 'ECONNRESET' } })).toBe(
      'ECONNRESET',
    );
    expect(imageConnectionErrorCode(null)).toBeNull();
  });
});
