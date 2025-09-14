import { UserRole } from "../auth.types";

export type ClubLite = {
  id: string;
  number: number;
  weekday: string;
};

export type TeacherProfileLite = {
  id: string;
  active: boolean;
  club: ClubLite | null;
};

export type CoordinatorProfileLite = {
  id: string;
  active: boolean;
  clubs: ClubLite[];
};

export class MeResponseDto {
  id!: string;
  email!: string;
  phone!: string;
  name!: string;
  active!: boolean;
  completed!: boolean;
  commonUser!: boolean;
  role!: UserRole;

  teacherProfile!: TeacherProfileLite | null;
  coordinatorProfile!: CoordinatorProfileLite | null;
}
