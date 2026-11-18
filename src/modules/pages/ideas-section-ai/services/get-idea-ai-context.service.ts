import { Injectable, Logger } from '@nestjs/common';
import {
  MediaItemEntity,
  MediaType,
} from 'src/shared/media/media-item/media-item.entity';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { IDEA_AI } from '../constants';
import { IdeaDocumentRendererProvider } from '../providers/idea-document-renderer.provider';
import {
  IdeaAiIdeaContext,
  IdeaAiMaterialContext,
  IdeaAiPreparedDocument,
} from '../types';
import { isIdeaAiVideo } from '../utils';

/**
 * Monta a visão da ideia inteira: título, descrição e o que há nos arquivos.
 *
 * A melhoria deixou de ser item por item: o texto enxerga os materiais e os
 * documentos enxergam o texto, então título, descrição e arquivos saem
 * coerentes entre si. Ler um arquivo aqui nunca derruba a tentativa: se a
 * leitura falha, o material entra só com o nome e a etapa do documento
 * tenta de novo e reporta o erro dela.
 */
@Injectable()
export class GetIdeaAiContextService {
  private readonly logger = new Logger(GetIdeaAiContextService.name);

  constructor(
    private readonly s3: AwsS3Service,
    private readonly renderer: IdeaDocumentRendererProvider,
  ) {}

  async get(
    title: string,
    description: string,
    medias: MediaItemEntity[],
  ): Promise<IdeaAiIdeaContext> {
    const materials: IdeaAiMaterialContext[] = [];
    const prepared = new Map<string, IdeaAiPreparedDocument>();
    let budget = IDEA_AI.contextCharactersTotal;
    for (const media of medias) {
      if (isIdeaAiVideo(media)) continue;
      const name = media.originalName ?? media.title ?? 'Material';
      let text: string | null = null;
      if (media.mediaType === MediaType.DOCUMENT && media.isLocalFile) {
        const document = await this.prepare(media);
        if (document) {
          prepared.set(media.id, document);
          const content = document.text.trim();
          text = content
            ? content.slice(
                0,
                Math.min(IDEA_AI.contextCharactersPerMaterial, budget),
              )
            : null;
          budget -= text?.length ?? 0;
        }
      }
      materials.push({ name, type: media.mediaType, text });
    }
    return { title, description, materials, prepared };
  }

  private async prepare(
    media: MediaItemEntity,
  ): Promise<IdeaAiPreparedDocument | null> {
    try {
      const bytes = await this.s3.downloadOwned(
        media.url,
        IDEA_AI.maxFileBytes,
      );
      const pdf = await this.renderer.toPdf(
        bytes,
        media.originalName ?? media.url,
      );
      const info = await this.renderer.inspect(pdf);
      return {
        pdf,
        text: info.text,
        pages: info.numpages,
        images: info.images,
      };
    } catch {
      this.logger.warn(
        `Não foi possível ler o material ${media.id} para o contexto da melhoria.`,
      );
      return null;
    }
  }
}
