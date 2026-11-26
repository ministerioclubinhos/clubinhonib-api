import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommentEntity } from './entities/comment.entity';
import { CommentController } from './comment.controller';
import { CommentsRepository } from './repositories/comments.repository';
import { CreateCommentService } from './services/create-comment.service';
import { GetCommentsService } from './services/get-comments.service';
import { UpdateCommentService } from './services/update-comment.service';
import { DeleteCommentService } from './services/delete-comment.service';

@Module({
  // `NotificationModule` é global; não precisa entrar aqui.
  imports: [TypeOrmModule.forFeature([CommentEntity])],
  controllers: [CommentController],
  providers: [
    CommentsRepository,
    CreateCommentService,
    GetCommentsService,
    UpdateCommentService,
    DeleteCommentService,
  ],
  exports: [GetCommentsService],
})
export class CommentModule {}
