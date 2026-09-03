import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserModule } from 'src/core/user/user.module';

import { SiteFeedbackEntity } from './entities/site-feedback.entity';
import { SiteFeedbackController } from './site-feedback.controller';
import { SiteFeedbacksRepository } from './repositories/site-feedbacks.repository';
import { CreateFeedbackService } from './services/create-feedback.service';
import { GetFeedbacksService } from './services/get-feedbacks.service';
import { UpdateFeedbackService } from './services/update-feedback.service';
import { DeleteFeedbackService } from './services/delete-feedback.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SiteFeedbackEntity]),
    forwardRef(() => UserModule),
  ],
  controllers: [SiteFeedbackController],
  providers: [
    SiteFeedbacksRepository,
    CreateFeedbackService,
    GetFeedbacksService,
    UpdateFeedbackService,
    DeleteFeedbackService,
  ],
  exports: [GetFeedbacksService],
})
export class SiteFeedbackModule {}
