import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload, UserRole } from '../auth.types';
import {
  AppUnauthorizedException,
  AppInternalException,
  ErrorCode,
} from 'src/shared/exceptions';

@Injectable()
export class AuthContextService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  getTokenFromRequest(req: Request): string | null {
    const auth = req.headers['authorization'] || req.headers['Authorization'];
    if (typeof auth === 'string') {
      const [scheme, token] = auth.split(' ');
      if (scheme?.toLowerCase() === 'bearer' && token) return token.trim();
    }

    const cookies = (req as unknown as { cookies?: Record<string, string> })
      .cookies;
    if (cookies?.['access_token']) return String(cookies['access_token']);
    if (cookies?.['auth_token']) return String(cookies['auth_token']);

    const q = (req as unknown as { query?: Record<string, string> }).query;
    if (q?.['access_token']) return String(q['access_token']);

    return null;
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    const secret =
      this.config.get<string>('JWT_SECRET') ?? process.env.JWT_SECRET ?? '';
    if (!secret) {
      throw new AppInternalException(
        ErrorCode.INTERNAL_ERROR,
        'JWT secret não configurado',
      );
    }
    const payload = await this.jwt.verifyAsync<JwtPayload>(token, { secret });
    return this.normalizePayload(payload);
  }

  decodeToken(token: string): JwtPayload | null {
    const decoded: string | { [key: string]: unknown } | null =
      this.jwt.decode(token);
    if (!decoded || typeof decoded === 'string') {
      return null;
    }
    const payload = decoded as unknown as JwtPayload;
    return this.normalizePayload(payload);
  }

  async getPayloadFromRequest(req: Request): Promise<JwtPayload> {
    const token = this.getTokenFromRequest(req);
    if (!token) {
      throw new AppUnauthorizedException(
        ErrorCode.TOKEN_MISSING,
        'Token não fornecido',
      );
    }
    return this.verifyToken(token);
  }

  async tryGetPayload(req: Request): Promise<JwtPayload | null> {
    try {
      return await this.getPayloadFromRequest(req);
    } catch {
      return null;
    }
  }

  async getUserId(req: Request): Promise<string | null> {
    const p = await this.tryGetPayload(req);
    return p?.sub ?? null;
  }

  async getEmail(req: Request): Promise<string | null> {
    const p = await this.tryGetPayload(req);
    return p?.email ?? null;
  }

  async getRole(req: Request): Promise<UserRole | null> {
    const p = await this.tryGetPayload(req);
    return (p?.role as UserRole) ?? null;
  }

  async isAdmin(req: Request): Promise<boolean> {
    const role = await this.getRole(req);
    return role === UserRole.ADMIN;
  }

  async isMember(req: Request): Promise<boolean> {
    const role = await this.getRole(req);
    return role === UserRole.TEACHER;
  }

  async isCoordinator(req: Request): Promise<boolean> {
    const role = await this.getRole(req);
    return role === UserRole.COORDINATOR;
  }

  async isLoggedIn(req: Request): Promise<boolean> {
    const token = this.getTokenFromRequest(req);
    if (!token) return false;

    try {
      await this.verifyToken(token);
      return true;
    } catch {
      return false;
    }
  }

  private normalizePayload(payload: JwtPayload): JwtPayload {
    const role = this.normalizeRole(payload.role);
    return { ...payload, role };
  }

  private normalizeRole(role?: string | UserRole): UserRole | undefined {
    if (!role) return undefined;
    const r = String(role).toLowerCase();
    if (r === (UserRole.ADMIN as string)) return UserRole.ADMIN;
    if (r === (UserRole.TEACHER as string)) return UserRole.TEACHER;
    if (r === (UserRole.COORDINATOR as string)) return UserRole.COORDINATOR;
    return undefined;
  }
}
