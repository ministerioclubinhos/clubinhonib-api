import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../auth.types';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  private readonly logger = new Logger(AdminRoleGuard.name);

  constructor(private readonly reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const { role } = user;

    if (!role) {
      throw new ForbiddenException('Insufficient permissions');
    }

    if (role !== UserRole.ADMIN) {
      throw new ForbiddenException('Access restricted to administrators');
    }

    return true;
  }
}

@Injectable()
export class AdminOrLeaderRoleGuard implements CanActivate {
  private readonly logger = new Logger(AdminOrLeaderRoleGuard.name);

  constructor(private readonly reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const { role } = user;

    if (!role) {
      throw new ForbiddenException('Insufficient permissions');
    }

    if (role !== UserRole.ADMIN && role !== UserRole.COORDINATOR) {
      throw new ForbiddenException('Access restricted to administrators and coordinators');
    }

    return true;
  }
}
