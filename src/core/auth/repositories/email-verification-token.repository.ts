import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { EmailVerificationTokenEntity } from '../entities/email-verification-token.entity';

@Injectable()
export class EmailVerificationTokenRepository {
  constructor(
    @InjectRepository(EmailVerificationTokenEntity)
    private readonly repo: Repository<EmailVerificationTokenEntity>,
  ) {}

  async createToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<EmailVerificationTokenEntity> {
    return this.repo.save(this.repo.create({ userId, tokenHash, expiresAt }));
  }

  /** Token válido correspondente ao hash, com o usuário carregado. */
  async findValidByHash(
    tokenHash: string,
  ): Promise<EmailVerificationTokenEntity | null> {
    const token = await this.repo.findOne({
      where: { tokenHash },
      relations: ['user'],
    });

    if (!token) return null;
    return token.expiresAt > new Date() ? token : null;
  }

  /** Token mais recente ainda válido do usuário, para não reenviar em série. */
  async findLatestValidOfUser(
    userId: string,
  ): Promise<EmailVerificationTokenEntity | null> {
    const token = await this.repo.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    if (!token) return null;
    return token.expiresAt > new Date() ? token : null;
  }

  async deleteAllOfUser(userId: string): Promise<void> {
    await this.repo.delete({ userId });
  }

  /** Limpa o que já venceu, para a tabela não crescer sem fim. */
  async deleteExpired(): Promise<void> {
    await this.repo.delete({ expiresAt: LessThan(new Date()) });
  }
}
