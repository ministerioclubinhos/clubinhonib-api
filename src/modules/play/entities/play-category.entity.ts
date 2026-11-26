import { Column, Entity } from 'typeorm';
import { BaseEntity } from 'src/shared/share-entity/base.entity';

/** Categoria do Clubinho Play, criada pelo administrador e atribuída à galeria. */
@Entity('play_categories')
export class PlayCategoryEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 120, unique: true })
  slug: string;

  @Column({ type: 'int', default: 0 })
  position: number;
}
