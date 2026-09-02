import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SiteFeedbackService } from './site-feedback.service';
import { SiteFeedbackController } from './site-feedback.controller';
import { SiteFeedbackEntity } from './entity/site-feedback.entity';
import { SiteFeedbackRepository } from './repository/site-feedback.repository';
import { UserModule } from 'src/core/user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SiteFeedbackEntity]),
    forwardRef(() => UserModule),
  ],
  controllers: [SiteFeedbackController],
  providers: [SiteFeedbackService, SiteFeedbackRepository],
})
export class SiteFeedbackModule {}
