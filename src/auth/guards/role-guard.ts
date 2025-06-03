import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from 'src/user/user.entity';

@Injectable()
export class RoleGuard implements CanActivate {
  private readonly logger = new Logger(RoleGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    this.logger.debug('🔒 RoleGuard: verificando permissões');

    if (!user) {
      this.logger.warn('❌ Acesso negado: usuário não autenticado');
      throw new ForbiddenException('Usuário não autenticado');
    }

    const { userId, email, role } = user;
    this.logger.debug(`👤 Usuário recebido: { id: ${userId}, email: ${email}, role: ${role ?? 'undefined'} }`);

    if (!role) {
      this.logger.warn('❌ Acesso negado: role ausente no token');
      throw new ForbiddenException('Permissão insuficiente');
    }

    if (role !== UserRole.ADMIN) {
      this.logger.warn(`❌ Acesso negado: role '${role}' não autorizado`);
      throw new ForbiddenException('Acesso restrito a administradores');
    }

    this.logger.log(`✅ Acesso permitido para role '${role}'`);
    return true;
  }
}
