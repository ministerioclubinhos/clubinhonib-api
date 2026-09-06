import { LogRecord, LogWriteError, LogWriteFailureKind } from '../types';
import { LogDeliveryQueue } from './log-delivery-queue';

const record = (id: string) => ({ eventId: id }) as unknown as LogRecord;
const options = {
  maxQueueSize: 2,
  writeTimeoutMs: 50,
  maxAttempts: 2,
  retryDelayMs: 0,
  drainTimeoutMs: 100,
};

describe('LogDeliveryQueue', () => {
  it('escreve em ordem e conta o que passou', async () => {
    const written: string[] = [];
    const queue = new LogDeliveryQueue(
      'q',
      (r) => {
        written.push(r.eventId);
        return Promise.resolve();
      },
      options,
      jest.fn(),
    );

    queue.enqueue(record('a'));
    queue.enqueue(record('b'));
    await queue.drain();

    expect(written).toEqual(['a', 'b']);
    expect(queue.snapshot()).toMatchObject({
      written: 2,
      dropped: 0,
      failed: 0,
    });
  });

  it('com a fila cheia descarta o mais novo, conta e sinaliza', async () => {
    const emergency = jest.fn();
    let release: () => void = () => undefined;
    const queue = new LogDeliveryQueue(
      'q',
      () => new Promise<void>((done) => (release = done)),
      { ...options, drainTimeoutMs: 10 },
      emergency,
    );

    // O item em escrita continua contando como pendente: capacidade 2 = a + b.
    expect(queue.enqueue(record('a'))).toBe(true);
    expect(queue.enqueue(record('b'))).toBe(true);
    expect(queue.enqueue(record('c'))).toBe(false);
    expect(queue.snapshot().dropped).toBe(1);
    expect(emergency).toHaveBeenCalledWith(
      'q',
      'fila cheia: evento descartado',
      expect.objectContaining({ eventId: 'c' }),
    );
    release();
    await queue.drain();
  });

  it('tenta de novo em erro transitório e desiste no permanente', async () => {
    const emergency = jest.fn();
    const attempts: Record<string, number> = {};
    const queue = new LogDeliveryQueue(
      'q',
      (r) => {
        attempts[r.eventId] = (attempts[r.eventId] ?? 0) + 1;
        if (r.eventId === 'transient' && attempts[r.eventId] === 1) {
          return Promise.reject(
            new LogWriteError('x', LogWriteFailureKind.Transient),
          );
        }
        if (r.eventId === 'permanent') {
          return Promise.reject(
            new LogWriteError('x', LogWriteFailureKind.Permanent),
          );
        }
        return Promise.resolve();
      },
      { ...options, maxQueueSize: 10 },
      emergency,
      () => Promise.resolve(),
    );

    queue.enqueue(record('transient'));
    queue.enqueue(record('permanent'));
    await queue.drain();

    expect(attempts).toEqual({ transient: 2, permanent: 1 });
    expect(queue.snapshot()).toMatchObject({ written: 1, failed: 1 });
    expect(emergency).toHaveBeenCalledWith(
      'q',
      'falha ao persistir evento',
      expect.objectContaining({ eventId: 'permanent' }),
    );
  });

  it('escrita que trava estoura o timeout e não bloqueia a fila', async () => {
    const queue = new LogDeliveryQueue(
      'q',
      (r) =>
        r.eventId === 'slow'
          ? new Promise<void>(() => undefined)
          : Promise.resolve(),
      { ...options, maxQueueSize: 10, maxAttempts: 1, drainTimeoutMs: 500 },
      jest.fn(),
    );

    queue.enqueue(record('slow'));
    queue.enqueue(record('fast'));
    await queue.drain();

    expect(queue.snapshot()).toMatchObject({ written: 1, failed: 1 });
  });

  it('depois de drenar, novos itens são descartados', async () => {
    const queue = new LogDeliveryQueue(
      'q',
      () => Promise.resolve(),
      options,
      jest.fn(),
    );
    await queue.drain();
    expect(queue.enqueue(record('late'))).toBe(false);
  });
});
