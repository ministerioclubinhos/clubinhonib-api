import { Injectable, Logger } from '@nestjs/common';

import { GetUsersService } from 'src/core/user/services/get-user.service';
import { EmailService } from 'src/shared/email';

import { ClubExceptionEntity } from '../entities/club-exception.entity';

/**
 * Avisa a base quando uma data é marcada como dia sem Clubinho.
 *
 * Vai para todos os usuários ativos, e não só para os clubinhos daquele dia da
 * semana: a exceção é global por data, quem coordena acompanha clubes de dias
 * diferentes, e um professor que troca de clube precisaria descobrir sozinho
 * que a regra mudou para ele.
 *
 * O texto nunca diz "feriado" — a exceção tem cinco motivos possíveis e feriado
 * é só um deles. O que aparece é o motivo cadastrado.
 */
@Injectable()
export class AnnounceClubExceptionService {
  private readonly logger = new Logger(AnnounceClubExceptionService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly getUsersService: GetUsersService,
  ) {}

  /** Dispara sem bloquear quem chamou e sem propagar erro. */
  announceInBackground(exception: ClubExceptionEntity): void {
    void this.announce(exception).catch((error: unknown) => {
      this.logger.error(
        `Falha ao avisar sobre a exceção ${exception.id}.`,
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  async announce(exception: ClubExceptionEntity): Promise<void> {
    // Uma exceção reativada volta como inativa até a gravação terminar; avisar
    // sobre uma data que não vale seria pior do que não avisar.
    if (!exception.isActive) {
      this.logger.warn(`Exceção ${exception.id} inativa: aviso não enviado.`);
      return;
    }

    const recipients = await this.getUsersService.findActiveRecipients();

    await this.emailService.sendClubDayCancelled(recipients, {
      date: String(exception.exceptionDate),
      reason: exception.reason,
      notes: exception.notes ?? undefined,
      isRecurrent: exception.isRecurrent,
    });
  }
}
