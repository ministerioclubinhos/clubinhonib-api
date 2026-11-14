import { Weekday } from '../entities/weekday.enum';

/**
 * Endereço no contrato de clubinhos.
 *
 * Sem os carimbos de data do endereço: quem lê um clubinho não tem o que fazer
 * com eles, e prometê-los obrigaria a carregá-los em toda listagem.
 */
export class ClubAddressResponseDto {
  id: string;
  street: string | null;
  number: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  complement: string | null;
}

/** Dados mínimos do usuário ligado a um perfil. */
export class ClubUserMiniDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  completed: boolean;
  commonUser: boolean;
}

/** Coordenador do clubinho. */
export class CoordinatorWithUserDto {
  id: string;
  active: boolean;
  user: ClubUserMiniDto | null;
}

/** Professor vinculado ao clubinho. */
export class TeacherWithUserDto {
  id: string;
  active: boolean;
  user: ClubUserMiniDto | null;
}

/** Clubinho sem os vínculos, para listas leves. */
export class ClubSimpleResponseDto {
  id: string;
  number: number;
  weekday: Weekday;
  /** Horário no formato `HH:mm`. */
  time: string | null;
  isActive: boolean;
  address: ClubAddressResponseDto | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Contrato de resposta de `/clubs`. */
export class ClubResponseDto extends ClubSimpleResponseDto {
  coordinator: CoordinatorWithUserDto | null;
  teachers: TeacherWithUserDto[];
}
