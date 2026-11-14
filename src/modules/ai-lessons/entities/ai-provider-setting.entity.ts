import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ai_provider_settings')
export class AiProviderSettingEntity {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  provider: string;

  @Column({ type: 'simple-json' })
  settings: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
