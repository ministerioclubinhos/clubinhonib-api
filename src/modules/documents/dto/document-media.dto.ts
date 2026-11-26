import { IsUrl, ValidateIf } from 'class-validator';
import { UploadType } from 'src/shared/media/media-item/media-item.entity';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';

/**
 * Mídia de um documento. Quando enviada por link, a URL precisa ser http(s):
 * o front abre esse endereço numa aba nova, então `javascript:`, `data:` e
 * afins não podem ser gravados.
 */
export class DocumentMediaDto extends MediaItemDto {
  @ValidateIf((media: DocumentMediaDto) => media.uploadType === UploadType.LINK)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'O link do documento deve ser uma URL http(s) válida.' },
  )
  declare url?: string;
}
