// src/modules/auth/auth.types.ts
export enum RoleUser {
  ADMIN = 'admin',
  TEACHER = 'teacher',
  COORDINATOR = 'coordinator',
}

export type JwtPayload = {
  sub: string;
  email?: string;
  role?: RoleUser | string;
  iat?: number;
  exp?: number;
};
