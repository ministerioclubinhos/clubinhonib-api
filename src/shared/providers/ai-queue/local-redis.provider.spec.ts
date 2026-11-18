import { ensureLocalRedis } from './local-redis.provider';
import { LOCAL_REDIS } from './constants';

describe('local Redis startup', () => {
  const deps = {
    ping: jest.fn(),
    docker: jest.fn(),
    wait: jest.fn().mockResolvedValue(undefined),
    log: jest.fn(),
  };
  beforeEach(() => {
    jest.clearAllMocks();
    deps.ping.mockReset();
    deps.docker.mockReset();
  });

  it('reuses a responding Redis without Docker, including remote instances', async () => {
    deps.ping.mockResolvedValue(true);
    await ensureLocalRedis('rediss://remote.test:6380/0', deps);
    expect(deps.docker).not.toHaveBeenCalled();
  });

  it('creates a persistent local container bound only to loopback', async () => {
    deps.ping.mockResolvedValueOnce(false).mockResolvedValue(true);
    deps.docker
      .mockReturnValueOnce('version')
      .mockImplementationOnce(() => {
        throw new Error('not found');
      })
      .mockReturnValue('created');
    await ensureLocalRedis('redis://localhost:6380/1', deps);
    expect(deps.docker).toHaveBeenCalledWith(
      expect.arrayContaining([
        'run',
        '127.0.0.1:6380:6379',
        `${LOCAL_REDIS.volume}:/data`,
        '--appendonly',
        'yes',
        '--maxmemory-policy',
        'noeviction',
      ]),
    );
  });

  it.each([
    ['exited', 'start'],
    ['created', 'start'],
    ['paused', 'unpause'],
  ])('reuses a %s container', async (state, command) => {
    deps.ping.mockResolvedValueOnce(false).mockResolvedValue(true);
    deps.docker.mockReturnValueOnce('version').mockReturnValueOnce(state);
    await ensureLocalRedis('redis://127.0.0.1:6379/0', deps);
    expect(deps.docker).toHaveBeenLastCalledWith([
      command,
      LOCAL_REDIS.container,
    ]);
  });

  it.each([
    'redis://remote.test/0',
    'redis://user:secret@localhost/0',
    'rediss://localhost/0',
  ])(
    'never creates a replacement for an unavailable configured server %s',
    async (url) => {
      deps.ping.mockResolvedValue(false);
      await expect(ensureLocalRedis(url, deps)).rejects.toThrow('indisponível');
      expect(deps.docker).not.toHaveBeenCalled();
    },
  );

  it('fails with a bounded wait when a running container exposes the wrong port', async () => {
    deps.ping.mockResolvedValue(false);
    deps.docker.mockReturnValueOnce('version').mockReturnValue('running');
    await expect(
      ensureLocalRedis('redis://localhost:6380/0', deps),
    ).rejects.toThrow('não respondeu ao PING');
    expect(deps.wait).toHaveBeenCalledTimes(LOCAL_REDIS.readyAttempts);
    expect(deps.docker).toHaveBeenCalledTimes(2);
  });

  it('reports unavailable Docker without leaking command stderr', async () => {
    deps.ping.mockResolvedValue(false);
    deps.docker.mockImplementation(() => {
      throw new Error('sensitive stderr');
    });
    await expect(ensureLocalRedis('redis://localhost/0', deps)).rejects.toThrow(
      'Docker indisponível',
    );
  });
});
