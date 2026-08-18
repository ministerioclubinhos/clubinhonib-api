import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UserEntity } from 'src/core/user/entities/user.entity';
import { JwtPayload, UserRole } from '../auth.types';
import { ErrorCode } from 'src/shared/exceptions';

describe('AuthService session lifecycle', () => {
  const configValues: Record<string, string> = {
    GOOGLE_CLIENT_ID: 'google-client-id',
    JWT_SECRET: 'access-secret',
    JWT_REFRESH_SECRET: 'refresh-secret',
    JWT_REFRESH_EXPIRES_IN: '7d',
  };

  let user: UserEntity;
  let jwtService: JwtService;
  let authRepository: { validateUser: jest.Mock };
  let userRepository: {
    findById: jest.Mock;
    updateRefreshToken: jest.Mock;
    rotateRefreshToken: jest.Mock;
  };
  let service: AuthService;

  beforeEach(async () => {
    user = {
      id: 'user-id',
      email: 'coordinator@example.com',
      name: 'Coordinator',
      phone: '92999999999',
      password: await bcrypt.hash('secret123', 4),
      role: UserRole.COORDINATOR,
      active: true,
      completed: true,
      commonUser: true,
      cpf: '',
      refreshToken: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as UserEntity;

    jwtService = new JwtService({
      secret: configValues.JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    });
    authRepository = { validateUser: jest.fn().mockResolvedValue(user) };
    userRepository = {
      findById: jest.fn().mockImplementation(() => Promise.resolve(user)),
      updateRefreshToken: jest
        .fn()
        .mockImplementation((_id: string, token: string | null) => {
          user.refreshToken = token;
          return Promise.resolve();
        }),
      rotateRefreshToken: jest
        .fn()
        .mockImplementation(
          (_id: string, currentToken: string, nextToken: string | null) => {
            if (user.refreshToken !== currentToken) return false;
            user.refreshToken = nextToken;
            return Promise.resolve(true);
          },
        ),
    };

    service = new AuthService(
      authRepository as never,
      jwtService,
      { getOrThrow: (key: string) => configValues[key] } as never,
      {} as never,
      {} as never,
      { findByEmail: jest.fn(), findOne: jest.fn() } as never,
      userRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {
        checkAndResendSesVerification: jest.fn().mockResolvedValue({
          verificationEmailSent: false,
          alreadyVerified: true,
        }),
      } as never,
      {} as never,
    );
  });

  const loginActiveUser = async () => {
    const result = await service.login({
      email: user.email,
      password: 'secret123',
    });
    if (!('accessToken' in result) || !('refreshToken' in result)) {
      throw new Error('Expected an active login response');
    }
    return result;
  };

  it('preserves the coordinator role and stores only a hash of the refresh token', async () => {
    const result = await loginActiveUser();

    expect(result.user?.role).toBe(UserRole.COORDINATOR);
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(user.refreshToken).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(user.refreshToken).not.toBe(result.refreshToken);

    const accessPayload = jwtService.decode<JwtPayload>(result.accessToken);
    const refreshPayload = jwtService.decode<JwtPayload>(result.refreshToken);
    expect(accessPayload?.tokenType).toBe('access');
    expect(refreshPayload?.tokenType).toBe('refresh');
  });

  it('rotates a refresh token once and rejects replay', async () => {
    const login = await loginActiveUser();
    const oldRefreshToken = login.refreshToken;

    const refreshed = await service.refreshToken(oldRefreshToken);
    expect(refreshed.refreshToken).not.toBe(oldRefreshToken);
    expect(userRepository.rotateRefreshToken).toHaveBeenCalledTimes(1);

    await expect(service.refreshToken(oldRefreshToken)).rejects.toMatchObject({
      code: ErrorCode.REFRESH_TOKEN_INVALID,
    });
  });

  it('migrates a legacy plaintext refresh token without breaking the session', async () => {
    const login = await loginActiveUser();
    user.refreshToken = login.refreshToken;

    const refreshed = await service.refreshToken(login.refreshToken);
    expect(typeof refreshed.accessToken).toBe('string');
    expect(typeof refreshed.refreshToken).toBe('string');
    expect(user.refreshToken).toMatch(/^sha256:/);
  });

  it('does not refresh the session of an inactive user', async () => {
    const login = await loginActiveUser();
    user.active = false;

    await expect(
      service.refreshToken(login.refreshToken),
    ).rejects.toMatchObject({
      code: ErrorCode.REFRESH_TOKEN_INVALID,
    });
  });

  it('revokes by refresh token and keeps logout idempotent', async () => {
    const login = await loginActiveUser();

    await expect(
      service.logout({ refreshToken: login.refreshToken }),
    ).resolves.toEqual({ message: 'User logged out' });
    expect(user.refreshToken).toBeNull();

    await expect(
      service.logout({ refreshToken: login.refreshToken }),
    ).resolves.toEqual({ message: 'User logged out' });
  });

  it('falls back to a valid access token when the supplied refresh is stale', async () => {
    const login = await loginActiveUser();

    await service.logout({
      refreshToken: 'stale-refresh-token',
      accessToken: login.accessToken,
    });

    expect(userRepository.updateRefreshToken).toHaveBeenLastCalledWith(
      user.id,
      null,
    );
    expect(user.refreshToken).toBeNull();
  });
});
