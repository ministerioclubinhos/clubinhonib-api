import { AiRequestQueueModule } from 'src/shared/providers/ai-queue/ai-request-queue.module';
import { Module } from '@nestjs/common';
import { MediaModule } from 'src/shared/media/media.module';
import { AwsModule } from 'src/shared/providers/aws/aws.module';
import { AiLessonsModule } from 'src/modules/ai-lessons/ai-lessons.module';
import { FeatureFlagsCoreModule } from 'src/core/feature-flags/feature-flags-core.module';
import { IdeasSectionAiRepository } from './repositories/ideas-section-ai.repository';
import { CreateIdeaSnapshotService } from './services/create-idea-snapshot.service';
import { CreateIdeaAiEnhancementService } from './services/create-idea-ai-enhancement.service';
import { GetIdeaAiEnhancementService } from './services/get-idea-ai-enhancement.service';
import { UpdateIdeaAiPublicationService } from './services/update-idea-ai-publication.service';
import { DeleteIdeaAiAssetsService } from './services/delete-idea-ai-assets.service';
import { ProcessIdeaAiEnhancementService } from './services/process-idea-ai-enhancement.service';
import { EnhanceIdeaTextService } from './services/enhance-idea-text.service';
import { EnhanceIdeaDocumentService } from './services/enhance-idea-document.service';
import { EnhanceIdeaImageService } from './services/enhance-idea-image.service';
import { IdeaEssenceGuardService } from './services/idea-essence-guard.service';
import { IdeaAiGatewayProvider } from './providers/idea-ai-gateway.provider';
import { IdeaDocumentRendererProvider } from './providers/idea-document-renderer.provider';
import { IdeaImageTransformProvider } from './providers/idea-image-transform.provider';
import { IdeasSectionAiEnhancementJob } from './jobs/ideas-section-ai-enhancement.job';
import { UpdateIdeaAiEnhancementService } from './services/update-idea-ai-enhancement.service';
import { IdeasSectionAiController } from './ideas-section-ai.controller';
@Module({
  imports: [
    AiRequestQueueModule,
    MediaModule,
    AwsModule,
    AiLessonsModule,
    FeatureFlagsCoreModule,
  ],
  controllers: [IdeasSectionAiController],
  providers: [
    IdeasSectionAiRepository,
    CreateIdeaSnapshotService,
    CreateIdeaAiEnhancementService,
    GetIdeaAiEnhancementService,
    UpdateIdeaAiPublicationService,
    UpdateIdeaAiEnhancementService,
    DeleteIdeaAiAssetsService,
    ProcessIdeaAiEnhancementService,
    EnhanceIdeaTextService,
    EnhanceIdeaDocumentService,
    EnhanceIdeaImageService,
    IdeaEssenceGuardService,
    IdeaAiGatewayProvider,
    IdeaDocumentRendererProvider,
    IdeaImageTransformProvider,
    IdeasSectionAiEnhancementJob,
  ],
  exports: [
    CreateIdeaSnapshotService,
    CreateIdeaAiEnhancementService,
    GetIdeaAiEnhancementService,
    UpdateIdeaAiPublicationService,
    DeleteIdeaAiAssetsService,
  ],
})
export class IdeasSectionAiModule {}
