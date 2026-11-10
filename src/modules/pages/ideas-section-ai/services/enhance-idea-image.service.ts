import { Injectable } from '@nestjs/common';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { IdeaAiGatewayProvider } from '../providers/idea-ai-gateway.provider';
import { IdeaImageTransformProvider } from '../providers/idea-image-transform.provider';
import { IdeaEssenceGuardService } from './idea-essence-guard.service';
import { IdeaAiMediaResult, IdeaAiProcessContext } from '../types';
import {
  IdeaAiMediaStatus,
  IdeaAiSkipReason,
} from '../enums/ideas-section-ai.enums';
import { IDEA_AI } from '../constants';
import { IDEA_IMAGE_SCHEMA } from '../schemas';
import { IdeaImageClassificationDto } from '../dto/enhanced-idea.dto';
@Injectable()
export class EnhanceIdeaImageService {
  constructor(
    private readonly s3: AwsS3Service,
    private readonly gateway: IdeaAiGatewayProvider,
    private readonly transform: IdeaImageTransformProvider,
    private readonly guard: IdeaEssenceGuardService,
  ) {}
  async enhance({
    settings,
    source,
    imageIndex,
  }: IdeaAiProcessContext): Promise<IdeaAiMediaResult> {
    const skipped = (skipReason: IdeaAiSkipReason): IdeaAiMediaResult => ({
      sourceMediaId: source.id,
      status: IdeaAiMediaStatus.SKIPPED,
      skipReason,
    });
    if (!source.isLocalFile) return skipped(IdeaAiSkipReason.NOT_SUPPORTED);
    if (imageIndex >= IDEA_AI.maxImages)
      return skipped(IdeaAiSkipReason.LIMIT_REACHED);
    const original = await this.transform.prepare(
      await this.s3.downloadOwned(source.url, IDEA_AI.maxFileBytes),
    );
    if (original.animated) return skipped(IdeaAiSkipReason.NOT_SUPPORTED);
    const classification = await this.gateway.json(
      settings,
      {
        schema: IDEA_IMAGE_SCHEMA,
        attachments: [original],
        data: {},
        instructions:
          'Classifique a imagem: containsPeople (na dúvida true), containsText, kind e qualityIssues. Não invente problemas. Fotos com qualquer pessoa só podem receber ajustes determinísticos.',
      },
      IdeaImageClassificationDto,
    );
    if (!classification.qualityIssues.length)
      return skipped(IdeaAiSkipReason.ALREADY_GOOD);
    const edited = classification.containsPeople
      ? await this.transform.deterministic(original.data)
      : await this.gateway.editImage(settings, original);
    const output = await this.transform.output(edited, original.format);
    let guard = await this.transform.compare(original.data, output);
    if (guard.approved)
      guard = await this.guard.verify(settings, '', '', [
        original,
        {
          data: output,
          mimeType: `image/${original.format}`,
          name: `melhorada.${original.format}`,
        },
      ]);
    if (!guard.approved)
      return {
        sourceMediaId: source.id,
        status: IdeaAiMediaStatus.REJECTED_BY_GUARD,
        guard,
      };
    return {
      sourceMediaId: source.id,
      status: IdeaAiMediaStatus.ENHANCED,
      guard,
      artifact: {
        buffer: output,
        mimeType: `image/${original.format}`,
        name: `ideia-melhorada.${original.format}`,
      },
    };
  }
}
