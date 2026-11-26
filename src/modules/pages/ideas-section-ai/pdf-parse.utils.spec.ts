import { parsePdfWithRetry } from './pdf-parse.utils';

const parsed = { text: 'conteúdo', numpages: 1 };

describe('leitura de PDF com repetição', () => {
  it('supera a falha intermitente do leitor e registra a repetição', async () => {
    const parse = jest
      .fn()
      .mockRejectedValueOnce(new Error('bad XRef entry'))
      .mockResolvedValue(parsed);
    const onRetry = jest.fn();

    await expect(
      parsePdfWithRetry(parse, Buffer.from('pdf'), 3, onRetry),
    ).resolves.toEqual(parsed);
    expect(parse).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });

  it('desiste no limite e devolve o erro do PDF realmente quebrado', async () => {
    const parse = jest.fn().mockRejectedValue(new Error('Invalid PDF'));

    await expect(
      parsePdfWithRetry(parse, Buffer.from('x'), 3, jest.fn()),
    ).rejects.toThrow('Invalid PDF');
    expect(parse).toHaveBeenCalledTimes(3);
  });
});
