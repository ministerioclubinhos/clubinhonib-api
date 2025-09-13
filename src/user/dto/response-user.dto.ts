import { Exclude, Expose } from 'class-transformer';
import { UserRole } from 'src/auth/auth.types';

@Exclude()
export class UserPublicDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  email: string;

  @Expose()
  phone: string;

  @Expose()
  role: UserRole;

  @Expose()
  active: boolean;

  @Expose()
  completed: boolean;

  @Expose() commonUser: boolean;
}

@Exclude()
export class UserResponseDto extends UserPublicDto {
  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
