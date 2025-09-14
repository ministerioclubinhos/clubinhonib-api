import { InformativeEntity } from '../entities/informative.entity';

export class InformativeResponseDto {
  id: string;
  title: string;
  description: string;
  public: boolean;
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(entity: InformativeEntity): InformativeResponseDto {
    return {
      id: entity.id,
      title: entity.title,
      description: entity.description,
      public: entity.public,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
