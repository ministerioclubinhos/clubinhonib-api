import { BaseEntity } from "src/share/share-entity/base.entity";
import { Column, Entity, ManyToOne } from "typeorm";
import { IdeasPageEntity } from "./ideas-page.entity";

@Entity({ name: 'ideas_sections' })
export class IdeasSectionEntity extends BaseEntity {
  @Column({ length: 255 })
  title: string;

  @Column('text')
  description: string;

  @Column({ default: false })
  public: boolean;

  @ManyToOne(() => IdeasPageEntity, (page) => page.sections, {
    onDelete: 'CASCADE',
  })
  page: IdeasPageEntity;
}