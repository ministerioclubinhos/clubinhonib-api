import { JwtStrategy } from './jwt.strategy';
import { UserRole } from '../auth.types';
import { ErrorCode } from 'src/shared/exceptions';

describe('JwtStrategy', () => {
  const activeUser = {
    id: 'user-id',
    email: 'coordinator@example.com',
    role: UserRole.COORDINATOR,
    active: true,
    refreshToken: 'sha256:active-session',
  };

  const createStrategy = (user: typeof activeUser | null) =>
    new JwtStrategy(
      { getOrThrow: () => 'access-secret' } as never,
      { findById: jest.fn().mockResolvedValue(user) } as never,
    );

  it('uses the current database role instead of a stale token role', async () => {
    const strategy = createStrategy(activeUser);

    await expect(
      strategy.validate({
        sub: activeUser.id,
        email: activeUser.email,
        role: UserRole.TEACHER,
        tokenType: 'access',
      }),
    ).resolves.toEqual({
      userId: activeUser.id,
      email: activeUser.email,
      role: UserRole.COORDINATOR,
    });
  });

  it.each([
    { ...activeUser, active: false },
    { ...activeUser, refreshToken: '' },
    null,
  ])('rejects users without an active server session', async (user) => {
    const strategy = createStrategy(user);

    await expect(
      strategy.validate({
        sub: activeUser.id,
        email: activeUser.email,
        role: UserRole.COORDINATOR,
        tokenType: 'access',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.TOKEN_INVALID });
  });

  it('rejects a refresh token in the access-token strategy', async () => {
    const strategy = createStrategy(activeUser);

    await expect(
      strategy.validate({
        sub: activeUser.id,
        email: activeUser.email,
        role: UserRole.COORDINATOR,
        tokenType: 'refresh',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.TOKEN_INVALID });
  });
});
