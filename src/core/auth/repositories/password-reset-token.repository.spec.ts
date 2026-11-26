import { DataSource } from 'typeorm';

import { hashAuthToken } from '../token.utils';
import { PasswordResetTokenRepository } from './password-reset-token.repository';

describe('PasswordResetTokenRepository', () => {
  const repository = new PasswordResetTokenRepository({
    createEntityManager: () => ({}),
  } as unknown as DataSource);
  const findOne = jest.spyOn(repository, 'findOne');
  const remove = jest
    .spyOn(repository, 'delete')
    .mockResolvedValue({ raw: {}, affected: 1 });
  jest
    .spyOn(repository, 'create')
    .mockImplementation((value) => value as never);
  const save = jest
    .spyOn(repository, 'save')
    .mockImplementation((value) => Promise.resolve(value as never));

  beforeEach(() => jest.clearAllMocks());

  it.each([undefined, ''])(
    'sem token (%p) não consulta o banco nem devolve registro alheio',
    async (token) => {
      await expect(
        repository.findValidToken(token as string),
      ).resolves.toBeNull();
      expect(findOne).not.toHaveBeenCalled();
    },
  );

  it('grava, procura e apaga pelo hash, nunca pelo valor do link', async () => {
    findOne.mockResolvedValue(null);

    await repository.createToken('user-1', 'segredo', new Date());
    await repository.findValidToken('segredo');
    await repository.deleteToken('segredo');

    const hashed = hashAuthToken('segredo');
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ token: hashed }),
    );
    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { token: hashed } }),
    );
    expect(remove).toHaveBeenCalledWith({ token: hashed });
  });
});
