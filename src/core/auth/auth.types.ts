import { Request } from 'express';

export enum UserRole {
  ADMIN = 'admin',
  TEACHER = 'teacher',
  COORDINATOR = 'coordinator',
}

export type JwtPayload = {
  sub: string;
  email?: string;
  role?: UserRole | string;
  iat?: number;
  exp?: number;
};

export type AuthRequest = Omit<Request, 'user'> & {
  user: {
    userId: string;
    role: UserRole | string;
    email: string;
  };
};

/**
 * Quem está pedindo a operação.
 *
 * Os casos de uso recebem isto, e não a requisição HTTP: quem lê o token é a
 * camada que enxerga o transporte. Antes cada módulo declarava a sua própria
 * cópia deste formato, e elas já haviam divergido no tipo do papel.
 */
export type AccessContext = {
  role?: UserRole;
  userId: string | null;
};
