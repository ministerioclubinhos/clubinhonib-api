import { BaseEntity } from 'src/share/share-entity/base.entity';
import {
  Entity,
  Column,
  OneToOne,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { AddressEntity } from 'src/modules/addresses/entities/address.entity/address.entity';
import { ClubEntity } from 'src/modules/clubs/entities/club.entity/club.entity';
import { PagelaEntity } from 'src/modules/pagelas/entities/pagela.entity';
import { AcceptedChristEntity } from 'src/modules/accepted-christs/entities/accepted-christ.entity';

@Entity('children')
export class ChildEntity extends BaseEntity {
  @Column({ length: 255 })
  name: string;

  @Column({ length: 255 })
  guardianName: string;

  @Column({ length: 255 })
  gender: string;

  @Column({ length: 32 })
  guardianPhone: string;

  @Column({ type: 'date' })
  birthDate: string;

  @Column({ type: 'date', nullable: true })
  joinedAt?: string | null;

  @ManyToOne(() => ClubEntity, (club) => club.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'club_id' })
  club: ClubEntity | null;

  @OneToOne(() => AddressEntity, {
    cascade: true,
    eager: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'address_id' })
  address?: AddressEntity | null;

  @OneToMany(() => PagelaEntity, (p) => p.child, { cascade: false })
  pagelas: PagelaEntity[];

  @OneToMany(() => AcceptedChristEntity, (ac) => ac.child, { cascade: true })
  acceptedChrists: AcceptedChristEntity[];
}
