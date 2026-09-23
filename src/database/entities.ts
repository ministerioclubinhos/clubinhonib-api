import { MeditationEntity } from 'src/modules/meditations/entities/meditation.entity';
import { DayEntity } from 'src/modules/meditations/entities/day.entity';
import { ImagePageEntity } from 'src/modules/pages/image-page/entity/Image-page.entity';
import { ImageSectionEntity } from 'src/modules/pages/image-page/entity/Image-section.entity';
import { RouteEntity } from 'src/modules/routes/route-page.entity';
import { UserEntity } from 'src/core/user/entities/user.entity';
import { PasswordResetTokenEntity } from 'src/core/auth/entities/password-reset-token.entity';
import { EmailVerificationTokenEntity } from 'src/core/auth/entities/email-verification-token.entity';
import { FeatureFlagEntity } from 'src/core/feature-flags/entities/feature-flag.entity';
import { PersonalData } from 'src/core/profile/entities/personal-data.entity';
import { UserPreferences } from 'src/core/profile/entities/user-preferences.entity';
import { VideosPage } from 'src/modules/pages/video-page/entities/video-page.entity';
import { WeekMaterialsPageEntity } from 'src/modules/pages/week-material-page/entities/week-material-page.entity';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { ContactEntity } from 'src/modules/contacts/entities/contact.entity';
import { EventEntity } from 'src/modules/pages/event-page/entities/event.entity';
import { CommentEntity } from 'src/modules/comments/entities/comment.entity';
import { DocumentEntity } from 'src/modules/documents/entities/document.entity';
import { IdeasSectionEntity } from 'src/modules/pages/ideas-page/entities/ideas-section.entity';
import { IdeasPageEntity } from 'src/modules/pages/ideas-page/entities/ideas-page.entity';
import { InformativeEntity } from 'src/modules/informatives/entities/informative.entity';
import { SiteFeedbackEntity } from 'src/modules/feedbacks/entities/site-feedback.entity';
import { ClubEntity } from 'src/modules/clubs/entities/club.entity';
import { TeacherProfileEntity } from 'src/modules/teacher-profiles/entities/teacher-profile.entity/teacher-profile.entity';
import { CoordinatorProfileEntity } from 'src/modules/coordinator-profiles/entities/coordinator-profile.entity/coordinator-profile.entity';
import { AddressEntity } from 'src/modules/addresses/entities/address.entity/address.entity';
import { ChildEntity } from 'src/modules/children/entities/child.entity';
import { PagelaEntity } from 'src/modules/pagelas/entities/pagela.entity';
import { AcceptedChristEntity } from 'src/modules/accepted-christs/entities/accepted-christ.entity';
import { ClubPeriodEntity } from 'src/modules/club-control/entities/club-period.entity';
import { ClubExceptionEntity } from 'src/modules/club-control/entities/club-exception.entity';
import { ClubControlLogEntity } from 'src/modules/club-control/entities/club-control-log.entity';
import { LessonEntity } from 'src/modules/ai-lessons/entities/lesson.entity';
import { LessonStageEntity } from 'src/modules/ai-lessons/entities/lesson-stage.entity';
import { LessonVersionEntity } from 'src/modules/ai-lessons/entities/lesson-version.entity';
import { LessonCommentEntity } from 'src/modules/ai-lessons/entities/lesson-comment.entity';
import { AdminLessonPromptEntity } from 'src/modules/ai-lessons/entities/admin-lesson-prompt.entity';

/**
 * Todas as entidades registradas na aplicação.
 *
 * A lista vive aqui, e não dentro do módulo, porque o `DataSource` do CLI
 * precisa exatamente das mesmas: gerar uma migration a partir de um conjunto
 * diferente do que a aplicação usa produziria um diff inventado.
 */
export const DATABASE_ENTITIES = [
  EventEntity,
  ImagePageEntity,
  ImageSectionEntity,
  RouteEntity,
  UserEntity,
  PasswordResetTokenEntity,
  EmailVerificationTokenEntity,
  FeatureFlagEntity,
  PersonalData,
  UserPreferences,
  VideosPage,
  WeekMaterialsPageEntity,
  MeditationEntity,
  DayEntity,
  MediaItemEntity,
  ContactEntity,
  CommentEntity,
  DocumentEntity,
  IdeasPageEntity,
  IdeasSectionEntity,
  InformativeEntity,
  SiteFeedbackEntity,
  ClubEntity,
  TeacherProfileEntity,
  CoordinatorProfileEntity,
  AddressEntity,
  ChildEntity,
  PagelaEntity,
  AcceptedChristEntity,
  ClubPeriodEntity,
  ClubExceptionEntity,
  ClubControlLogEntity,
  LessonEntity,
  LessonStageEntity,
  LessonVersionEntity,
  LessonCommentEntity,
  AdminLessonPromptEntity,
];
