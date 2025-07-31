import { UserRole } from "../user.entity";

export class CreateUserDto {
  name: string;
  email: string;
  password: string;
  phone: string;
  role?: UserRole; 
  completed?: boolean;
  commonUser?: boolean;
  active?: boolean;
}
