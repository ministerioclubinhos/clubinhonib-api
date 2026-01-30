import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, AuthRequest } from '../auth.types';
import {
  AppForbiddenException,
  AppUnauthorizedException,
  ErrorCode,
} from 'src/shared/exceptions';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  private readonly logger = new Logger(AdminRoleGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const user = request.user;

    if (!user) {
      throw new AppUnauthorizedException(
        ErrorCode.TOKEN_MISSING,
        'Usuário não autenticado',
      );
    }

    const { role } = user;

    if (!role) {
      throw new AppForbiddenException(
        ErrorCode.INSUFFICIENT_PERMISSIONS,
        'Permissões insuficientes',
      );
    }

    if (role !== (UserRole.ADMIN as string)) {
      throw new AppForbiddenException(
        ErrorCode.ROLE_NOT_ALLOWED,
        'Acesso restrito a administradores',
      );
    }

    return true;
  }
}

@Injectable()
export class AdminOrLeaderRoleGuard implements CanActivate {
  private readonly logger = new Logger(AdminOrLeaderRoleGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const user = request.user;

    if (!user) {
      throw new AppUnauthorizedException(
        ErrorCode.TOKEN_MISSING,
        'Usuário não autenticado',
      );
    }

    const { role } = user;

    if (!role) {
      throw new AppForbiddenException(
        ErrorCode.INSUFFICIENT_PERMISSIONS,
        'Permissões insuficientes',
      );
    }

    if (
      role !== (UserRole.ADMIN as string) &&
      role !== (UserRole.COORDINATOR as string)
    ) {
      throw new AppForbiddenException(
        ErrorCode.ROLE_NOT_ALLOWED,
        'Acesso restrito a administradores e coordenadores',
      );
    }

    return true;
  }
}
