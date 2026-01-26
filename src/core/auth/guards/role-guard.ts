import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../auth.types';
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
    const request = context.switchToHttp().getRequest();
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

    if (role !== UserRole.ADMIN) {
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
    const request = context.switchToHttp().getRequest();
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

    if (role !== UserRole.ADMIN && role !== UserRole.COORDINATOR) {
      throw new AppForbiddenException(
        ErrorCode.ROLE_NOT_ALLOWED,
        'Acesso restrito a administradores e coordenadores',
      );
    }

    return true;
  }
}
