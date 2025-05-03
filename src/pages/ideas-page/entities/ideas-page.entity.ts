import { BaseEntity } from "src/share/share-entity/base.entity";
import { Column, Entity, JoinColumn, OneToMany, OneToOne } from "typeorm";
import { IdeasSectionEntity } from "./ideas-section.entity";
import { RouteEntity } from "src/route/route-page.entity";

@Entity({ name: 'ideas_pages' })
export class IdeasPageEntity extends BaseEntity {
  @Column({ length: 255 })
  title: string;

  @Column({ length: 255, default: '' })
  subtitle?: string;

  @Column('text')
  description: string;

  @Column({ default: false })
  public: boolean;

  @OneToMany(() => IdeasSectionEntity, (section) => section.page, {
    cascade: ['insert', 'update', 'remove'],
    eager: true,
  })
  sections: IdeasSectionEntity[];

  @OneToOne(() => RouteEntity, {
    cascade: true,
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  route: RouteEntity | null;
}