import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

import { UNSUBSCRIBE_TOKEN_SEPARATOR } from './constants';

/**
 * O token que identifica quem pediu para sair da lista.
 *
 * É um HMAC do id do usuário, e não um JWT: o link vive dentro de um e-mail
 * que a pessoa pode abrir meses depois, então não pode expirar — e um token
 * assinado com o segredo da sessão poderia ser confundido com credencial de
 * acesso. Aqui ele só serve para uma coisa, e não abre nada.
 *
 * Nada é guardado: o token se valida sozinho contra o segredo do servidor.
 */
@Injectable()
export class UnsubscribeTokenService {
  private readonly logger = new Logger(UnsubscribeTokenService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Segredo da assinatura.
   *
   * `EMAIL_UNSUBSCRIBE_SECRET` mantém este token separado do de sessão; sem
   * ela, cai no segredo do JWT para a funcionalidade não depender de uma
   * variável nova em todo ambiente.
   */
  private get secret(): string {
    const dedicated = this.configService.get<string>(
      'EMAIL_UNSUBSCRIBE_SECRET',
    );
    if (dedicated?.trim()) return dedicated.trim();

    const fallback = this.configService.get<string>('JWT_SECRET');
    if (fallback?.trim()) return fallback.trim();

    // Sem segredo não há assinatura possível, e um token que qualquer um
    // forjaria descadastraria terceiros.
    throw new Error(
      'EMAIL_UNSUBSCRIBE_SECRET ou JWT_SECRET precisa estar configurado.',
    );
  }

  private sign(userId: string): string {
    return createHmac('sha256', this.secret).update(userId).digest('base64url');
  }

  /** Token de quem recebe o e-mail. */
  create(userId: string): string {
    return `${userId}${UNSUBSCRIBE_TOKEN_SEPARATOR}${this.sign(userId)}`;
  }

  /**
   * O id de quem assinou o token, ou `null` quando ele não confere.
   *
   * A comparação é de tempo constante: comparar com `===` vazaria, pelo tempo
   * de resposta, o quanto de uma assinatura forjada estava certo.
   */
  verify(token: string): string | null {
    const separator = token.lastIndexOf(UNSUBSCRIBE_TOKEN_SEPARATOR);
    if (separator <= 0) return null;

    const userId = token.slice(0, separator);
    const signature = token.slice(separator + 1);
    if (!userId || !signature) return null;

    const expected = Buffer.from(this.sign(userId));
    const received = Buffer.from(signature);

    if (expected.length !== received.length) return null;
    if (!timingSafeEqual(expected, received)) {
      this.logger.warn('Token de descadastro com assinatura inválida.');
      return null;
    }

    return userId;
  }
}
