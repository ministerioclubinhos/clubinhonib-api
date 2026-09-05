import { UserRole } from '../auth.types';
import { EmailVerificationResult } from '../services/email-verification.service';

/**
 * Contratos de resposta de `/auth`.
 *
 * Os métodos do controller devolviam o tipo inferido do service, e o service
 * devolvia o tipo inferido do objeto literal: uma chave a mais em qualquer
 * `return` mudava o contrato HTTP sem erro de compilação e sem teste quebrando.
 * Este arquivo declara o que cada rota entrega.
 */

/**
 * O usuário como as respostas de login e cadastro o devolvem.
 *
 * É o recorte enxuto: sem imagem e sem os perfis de professor e coordenador,
 * que só saem por `/auth/me` e `GET /profile`.
 */
export class AuthUserDto {
  id: string;
  email: string;
  name: string;
  active: boolean;
  completed: boolean;
  commonUser: boolean;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
  role: UserRole;
}

/**
 * Resposta de `POST /auth/login`.
 *
 * Conta inativa recebe a mesma forma **sem** os tokens: quem ainda não
 * confirmou o e-mail não ganha sessão. Por isso os dois são opcionais.
 */
export class AuthLoginResponseDto {
  message: string;
  user: AuthUserDto;
  accessToken?: string;
  refreshToken?: string;
  emailVerification?: EmailVerificationResult;
}

/**
 * Resposta de `POST /auth/google`.
 *
 * São quatro formas diferentes conforme o estado da conta — recém-criada, com
 * cadastro incompleto, inativa e com sessão liberada — e só a última traz
 * `user` e tokens. Elas divergem entre si: as três primeiras marcam
 * `newUser`, e a quarta marca `isNewUser`. O nome inconsistente está
 * documentado aqui porque a tela já depende dos dois; unificar é mudança de
 * contrato e precisa sair combinada com o front.
 */
export class AuthGoogleLoginResponseDto {
  /** Ausente quando a conta acabou de ser criada ou está incompleta. */
  message?: string;
  /** Só na forma com sessão liberada. */
  user?: AuthUserDto;
  accessToken?: string;
  refreshToken?: string;
  emailVerification?: EmailVerificationResult;
  /** Presente nas formas sem sessão. */
  email?: string;
  name?: string;
  completed?: boolean;
  commonUser?: boolean;
  active?: boolean;
  /** Nas formas sem sessão. */
  newUser?: boolean;
  /** Na forma com sessão — mesmo sentido, outro nome. */
  isNewUser?: boolean;
}

/** Par de tokens devolvido pela renovação. */
export class AuthTokensResponseDto {
  accessToken: string;
  refreshToken: string;
}

/**
 * Resposta de cadastro e de conclusão de cadastro.
 *
 * `user` não vem na conclusão de cadastro: lá o usuário já é conhecido de quem
 * chamou.
 */
export class AuthRegisterResponseDto {
  message: string;
  user?: AuthUserDto;
  emailVerification?: EmailVerificationResult;
}

/** Resposta de saída da sessão. */
export class AuthLogoutResponseDto {
  message: string;
}

/**
 * Resposta do pedido de recuperação de senha.
 *
 * É sempre a mesma, exista ou não conta com aquele endereço: uma resposta
 * diferente contaria a quem perguntou quais e-mails estão cadastrados.
 */
export class ForgotPasswordResponseDto {
  status: string;
  message: string;
}

/** Resposta da checagem do link de redefinição. */
export class ValidateResetTokenResponseDto {
  valid: boolean;
  email: string;
}

/** Resposta da troca de senha. */
export class ResetPasswordResponseDto {
  message: string;
}

/** Resposta da confirmação de e-mail. */
export class VerifyEmailResponseDto {
  message: string;
  email: string;
}

/** Resposta do reenvio da confirmação de e-mail. */
export class ResendVerificationResponseDto {
  emailVerification: EmailVerificationResult;
}

/** Resposta do vínculo de um professor a um clubinho. */
export class LinkClubResponseDto {
  message: string;
}
