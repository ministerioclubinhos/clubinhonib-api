import { Entity, Column, Index, OneToOne, JoinColumn } from 'typeorm';
import { RouteEntity } from 'src/modules/routes/route-page.entity';
import { BaseEntity } from 'src/shared/share-entity/base.entity';

@Entity('week_material_pages')
export class WeekMaterialsPageEntity extends BaseEntity {
  @Column()
  title: string;

  @Column({ type: 'text' })
  subtitle: string;

  @Column({ default: false })
  currentWeek: boolean;

  @Column({ type: 'text' })
  description: string;

  @Index('uq_week_material_pages_source_lesson_id', { unique: true })
  @Column({
    name: 'source_lesson_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  sourceLessonId: string | null;

  @OneToOne(() => RouteEntity, {
    cascade: true,
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  route: RouteEntity;
}
