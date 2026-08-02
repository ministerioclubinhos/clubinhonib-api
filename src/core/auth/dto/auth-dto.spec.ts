import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto';
import { RegisterUserDto } from './register.dto';
import { CompleteUserDto } from './complete-register.dto';
import { UserRole } from '../auth.types';

describe('authentication DTOs', () => {
  it('normalizes an email without changing the password', async () => {
    const dto = plainToInstance(LoginDto, {
      email: '  Person@Example.COM ',
      password: '  password with spaces  ',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.email).toBe('person@example.com');
    expect(dto.password).toBe('  password with spaces  ');
  });

  it.each([UserRole.TEACHER, UserRole.COORDINATOR])(
    'accepts the supported %s public registration',
    async (role) => {
      const dto = plainToInstance(RegisterUserDto, {
        name: 'Person',
        email: `${role}@example.com`,
        phone: '92999999999',
        password: 'secret123',
        role,
      });

      expect(await validate(dto)).toHaveLength(0);
    },
  );

  it('does not allow public admin registration', async () => {
    const dto = plainToInstance(RegisterUserDto, {
      name: 'Person',
      email: 'admin@example.com',
      phone: '92999999999',
      password: 'secret123',
      role: UserRole.ADMIN,
    });

    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('keeps role optional when completing a legacy Google registration', async () => {
    const dto = plainToInstance(CompleteUserDto, {
      name: 'Person',
      email: ' PERSON@EXAMPLE.COM ',
      phone: '92999999999',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.email).toBe('person@example.com');
  });
});
