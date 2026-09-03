import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';

import { DocumentEntity } from './entities/document.entity';
import { toDocumentResponse } from './mappers';

/**
 * Trava o formato da resposta de documentos.
 *
 * O front declara os mesmos campos em `src/features/documents/types.ts`.
 */
describe('toDocumentResponse (contrato de resposta)', () => {
  const document = {
    id: 'document-1',
    name: 'Regulamento 2026',
    description: 'Documento oficial',
    createdAt: new Date('2026-03-01T10:00:00Z'),
    updatedAt: new Date('2026-03-02T10:00:00Z'),
  } as unknown as DocumentEntity;

  it('expõe exatamente os campos do contrato', () => {
    expect(Object.keys(toDocumentResponse(document)).sort()).toEqual(
      ['createdAt', 'description', 'id', 'media', 'name', 'updatedAt'].sort(),
    );
  });

  it('devolve nulo quando o documento ficou sem arquivo', () => {
    expect(toDocumentResponse(document).media).toBeNull();
    expect(
      toDocumentResponse({ ...document, description: undefined } as never)
        .description,
    ).toBeNull();
  });

  it('entrega o arquivo no recorte do contrato, sem a entidade inteira', () => {
    const media = {
      id: 'media-1',
      title: 'Regulamento.pdf',
      description: null,
      uploadType: 'upload',
      mediaType: 'document',
      isLocalFile: true,
      url: 'https://example.com/doc.pdf',
      platformType: null,
      originalName: 'doc.pdf',
      size: 4096,
      targetId: 'document-1',
      targetType: 'Document',
    } as unknown as MediaItemEntity;

    const response = toDocumentResponse(document, media);

    expect(Object.keys(response.media ?? {}).sort()).toEqual(
      [
        'description',
        'id',
        'isLocalFile',
        'mediaType',
        'originalName',
        'platformType',
        'size',
        'title',
        'uploadType',
        'url',
      ].sort(),
    );
    expect(response.media).not.toHaveProperty('targetId');
  });
});
