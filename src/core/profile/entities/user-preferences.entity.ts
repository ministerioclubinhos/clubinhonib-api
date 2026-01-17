import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { UserEntity } from '../../user/entities/user.entity';
import { BaseEntity } from 'src/shared/share-entity/base.entity';

@Entity('user_preferences')
export class UserPreferences extends BaseEntity {
  @Column({ nullable: true })
  loveLanguages?: string;

  @Column({ nullable: true })
  temperaments?: string;

  @Column({ nullable: true })
  favoriteColor?: string;

  @Column({ nullable: true })
  favoriteFood?: string;

  @Column({ nullable: true })
  favoriteMusic?: string;

  @Column({ type: 'text', nullable: true })
  whatMakesYouSmile?: string;

  @Column({ type: 'text', nullable: true })
  skillsAndTalents?: string;

  @OneToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;

  @Column()
  userId: string;
}
