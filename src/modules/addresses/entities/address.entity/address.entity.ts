import { BaseEntity } from 'src/share/share-entity/base.entity';
import { Entity, Column } from 'typeorm';
import { IsOptional, IsString } from 'class-validator';

@Entity('addresses')
export class AddressEntity extends BaseEntity {
  @Column()
  @IsString()
  street: string;

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  number?: string;

  @Column()
  @IsString()
  district: string;

  @Column()
  @IsString()
  city: string;

  @Column()
  @IsString()
  state: string;

  @Column()
  @IsString()
  postalCode: string;

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  complement?: string;
}
