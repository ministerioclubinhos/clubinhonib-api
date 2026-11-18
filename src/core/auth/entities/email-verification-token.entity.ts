import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { UserEntity } from 'src/core/user/entities/user.entity';

@Entity('email_verification_tokens')
export class EmailVerificationTokenEntity extends BaseEntity {
  /**
   * Hash SHA-256 do token enviado por e-mail. O valor original só existe no
   * link: um vazamento do banco não permite confirmar a conta de ninguém.
   */
  @Index({ unique: true })
  @Column({ length: 64 })
  tokenHash: string;

  @Column()
  expiresAt: Date;

  @Column()
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;
}
