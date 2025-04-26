import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { CreateCommentDto } from '../dto/create-comment.dto';
import { CommentEntity } from '../entity/comment.entity';

@Injectable()
export class CommentRepository extends Repository<CommentEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(CommentEntity, dataSource.createEntityManager());
  }

  async createAndSave(dto: CreateCommentDto): Promise<CommentEntity> {
    const comment = this.create(dto);
    return this.save(comment);
  }

  async findAllPublished(): Promise<CommentEntity[]> {
    return this.find({
      where: { published: true },
      order: { createdAt: 'DESC' },
    });
  }
  async findAll(): Promise<CommentEntity[]> {
    return this.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<CommentEntity | null> {
    return this.findOneBy({ id });
  }

  async updateAndSave(entity: CommentEntity, dto: CreateCommentDto): Promise<CommentEntity> {
    Object.assign(entity, dto);
    return this.save(entity);
  }

  async removeComment(entity: CommentEntity): Promise<void> {
    await this.remove(entity);
  }
}
