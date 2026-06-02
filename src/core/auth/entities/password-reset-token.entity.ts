import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { UserEntity } from 'src/core/user/entities/user.entity';

@Entity('password_reset_tokens')
export class PasswordResetTokenEntity extends BaseEntity {
  @Column()
  token: string;

  @Column()
  expiresAt: Date;

  @Column()
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;
}
