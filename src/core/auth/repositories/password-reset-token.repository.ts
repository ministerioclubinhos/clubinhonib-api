import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { PasswordResetTokenEntity } from '../entities/password-reset-token.entity';

@Injectable()
export class PasswordResetTokenRepository extends Repository<PasswordResetTokenEntity> {
    constructor(private dataSource: DataSource) {
        super(PasswordResetTokenEntity, dataSource.createEntityManager());
    }

    async createToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetTokenEntity> {
        const newToken = this.create({
            userId,
            token,
            expiresAt,
        });
        return this.save(newToken);
    }

    async findValidToken(token: string): Promise<PasswordResetTokenEntity | null> {
        const entity = await this.findOne({
            where: { token },
            relations: ['user'],
        });

        if (!entity) return null;
        if (entity.expiresAt < new Date()) return null;

        return entity;
    }

    async deleteToken(token: string): Promise<void> {
        await this.delete({ token });
    }

    async invalidateTokensForUser(userId: string): Promise<void> {
        await this.delete({ userId });
    }
}
