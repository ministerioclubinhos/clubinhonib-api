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
