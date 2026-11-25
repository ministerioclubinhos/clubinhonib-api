import { Entity, Column, OneToOne, JoinColumn, ManyToOne } from 'typeorm';
import { RouteEntity } from 'src/modules/routes/route-page.entity';
import { PlayCategoryEntity } from 'src/modules/play/entities/play-category.entity';
import { PlayScope } from 'src/modules/play/enums/play-scope.enum';
import { BaseEntity } from 'src/shared/share-entity/base.entity';

@Entity('videos_pages')
export class VideosPage extends BaseEntity {
  @Column()
  name: string;

  @Column()
  public: boolean;

  @Column({ type: 'text' })
  description: string;

  /** Quais vídeos aparecem no Clubinho Play. */
  @Column({
    name: 'play_scope',
    type: 'enum',
    enum: PlayScope,
    default: PlayScope.NONE,
  })
  playScope: PlayScope;

  /** Categoria da galeria no Clubinho Play. */
  @Column({
    name: 'play_category_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  playCategoryId: string | null;

  @ManyToOne(() => PlayCategoryEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'play_category_id' })
  playCategory?: PlayCategoryEntity | null;

  @OneToOne(() => RouteEntity, {
    cascade: true,
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  route: RouteEntity;
}
