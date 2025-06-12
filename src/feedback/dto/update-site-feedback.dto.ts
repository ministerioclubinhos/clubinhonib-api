import { PartialType } from '@nestjs/mapped-types';
import { CreateSiteFeedbackDto } from './create-site-feedback.dto';

export class UpdateSiteFeedbackDto extends PartialType(CreateSiteFeedbackDto) {}
