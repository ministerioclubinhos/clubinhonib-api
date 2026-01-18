import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { Entity, Column } from 'typeorm';
import { IsOptional, IsString } from 'class-validator';

@Entity('addresses')
export class AddressEntity extends BaseEntity {
  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  street?: string;

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  number?: string;

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  district?: string;

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  city?: string;

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  state?: string;

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  postalCode?: string;

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  complement?: string;
}
