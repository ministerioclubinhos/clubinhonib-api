import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CompleteUserDto } from '../dto/complete-register.dto';
import { RegisterUserDto } from '../dto/register.dto';
import { UserRole } from '../auth.types';
import { AuthService } from './auth.service';

const ACCESS_SECRET = 'segredo-de-acesso';

const roleErrors = async (
  dto: typeof RegisterUserDto | typeof CompleteUserDto,
  role: string,
): Promise<boolean> => {
  const instance = plainToInstance<object, object>(dto, {
    name: 'Fulano',
    email: 'fulano@teste.com',
    phone: '92999990000',
    password: 'Senha123@',
    registrationToken: 'x',
    role,
  });
  return (await validate(instance)).some((error) => error.property === 'role');
};

describe('cadastro público: papéis aceitos', () => {
  it.each([RegisterUserDto, CompleteUserDto])(
    'recusa administrador em %p',
    async (dto) => {
      expect(await roleErrors(dto, UserRole.ADMIN)).toBe(true);
    },
  );

  it.each([UserRole.TEACHER, UserRole.COORDINATOR])(
    'aceita %s',
    async (role) => {
      expect(await roleErrors(RegisterUserDto, role)).toBe(false);
      expect(await roleErrors(CompleteUserDto, role)).toBe(false);
    },
  );
});

describe('completar cadastro exige o comprovante do Google', () => {
  const pending = { id: 'user-1', email: 'fulano@teste.com', completed: false };
  const jwt = new JwtService({ secret: ACCESS_SECRET });
  const update = jest.fn();
  const findByEmail = jest.fn();
  const config = {
    getOrThrow: (key: string) =>
      key === 'JWT_SECRET' ? ACCESS_SECRET : 'google-client',
  } as unknown as ConfigService;

  const service = new AuthService(
    {} as never,
    jwt,
    config,
    {} as never,
    { update } as never,
    { findByEmail } as never,
    {
      sendIfPending: jest.fn().mockResolvedValue({}),
    } as never,
    {} as never,
    {} as never,
  );

  const complete = (registrationToken: string) =>
    service.completeRegister({
      email: pending.email,
      name: 'Fulano',
      phone: '92999990000',
      password: 'Senha123@',
      role: UserRole.TEACHER,
      registrationToken,
    });

  const sign = (sub: string): string =>
    (
      service as unknown as { signRegistrationToken(id: string): string }
    ).signRegistrationToken(sub);

  beforeEach(() => {
    jest.clearAllMocks();
    findByEmail.mockResolvedValue(pending);
  });

  it.each([
    ['um texto qualquer', 'invalido'],
    ['um token de acesso', jwt.sign({ sub: pending.id })],
    ['o comprovante de outra conta', sign('user-2')],
  ])('recusa %s sem alterar a conta', async (_label, token) => {
    await expect(complete(token)).rejects.toMatchObject({ status: 401 });
    expect(update).not.toHaveBeenCalled();
  });

  it('não revela se o e-mail existe', async () => {
    findByEmail.mockResolvedValue(null);

    await expect(complete(sign(pending.id))).rejects.toMatchObject({
      status: 401,
    });
  });

  it('completa o cadastro com o comprovante da própria conta', async () => {
    await complete(sign(pending.id));

    expect(update).toHaveBeenCalledWith(
      pending.id,
      expect.objectContaining({ completed: true, role: UserRole.TEACHER }),
    );
  });

  it('o comprovante não vale como token de acesso', () => {
    expect(() => jwt.verify(sign(pending.id))).toThrow();
  });
});
