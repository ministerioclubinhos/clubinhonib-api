import { BaseEntity } from 'src/share/share-entity/base.entity';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('contacts')
export class ContactEntity extends BaseEntity {

    @Column()
    name: string;

    @Column()
    email: string;

    @Column()
    phone: string;

    @Column('text')
    message: string;

}
