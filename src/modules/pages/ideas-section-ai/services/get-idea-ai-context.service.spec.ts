import { Test } from '@nestjs/testing';
import {
  MediaItemEntity,
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { IDEA_AI } from '../constants';
import { IdeaDocumentRendererProvider } from '../providers/idea-document-renderer.provider';
import { GetIdeaAiContextService } from './get-idea-ai-context.service';

describe('GetIdeaAiContextService', () => {
  const s3 = { downloadOwned: jest.fn() };
  const renderer = { toPdf: jest.fn(), inspect: jest.fn() };
  let service: GetIdeaAiContextService;
  const media = (
    id: string,
    mediaType: MediaType,
    extra: Partial<MediaItemEntity> = {},
  ) =>
    ({
      id,
      mediaType,
      isLocalFile: true,
      uploadType: UploadType.UPLOAD,
      originalName: `${id}.pdf`,
      url: `https://bucket/${id}`,
      ...extra,
    }) as MediaItemEntity;

  beforeEach(async () => {
    jest.resetAllMocks();
    s3.downloadOwned.mockResolvedValue(Buffer.from('file'));
    renderer.toPdf.mockResolvedValue(Buffer.from('pdf'));
    renderer.inspect.mockResolvedValue({ text: 'Use 3 bolas.', numpages: 1 });
    const module = await Test.createTestingModule({
      providers: [
        GetIdeaAiContextService,
        { provide: AwsS3Service, useValue: s3 },
        { provide: IdeaDocumentRendererProvider, useValue: renderer },
      ],
    }).compile();
    service = module.get(GetIdeaAiContextService);
  });

  it('reads each document once and hands the prepared PDF to the next step', async () => {
    const context = await service.get('Gincana', 'Descrição', [
      media('doc', MediaType.DOCUMENT),
    ]);
    expect(context.materials).toEqual([
      { name: 'doc.pdf', type: MediaType.DOCUMENT, text: 'Use 3 bolas.' },
    ]);
    expect(context.prepared.get('doc')).toMatchObject({ text: 'Use 3 bolas.' });
    expect(s3.downloadOwned).toHaveBeenCalledTimes(1);
  });

  it('keeps an image-only PDF as a material without text', async () => {
    renderer.inspect.mockResolvedValue({ text: ' ', numpages: 1 });
    const context = await service.get('t', 'd', [
      media('scan', MediaType.DOCUMENT),
    ]);
    expect(context.materials[0].text).toBeNull();
  });

  it('lists images by name only and never downloads them', async () => {
    const context = await service.get('t', 'd', [
      media('foto', MediaType.IMAGE, { originalName: 'foto.png' }),
    ]);
    expect(context.materials).toEqual([
      { name: 'foto.png', type: MediaType.IMAGE, text: null },
    ]);
    expect(s3.downloadOwned).not.toHaveBeenCalled();
  });

  it('survives an unreadable file without failing the attempt', async () => {
    s3.downloadOwned.mockRejectedValue(new Error('boom'));
    const context = await service.get('t', 'd', [
      media('doc', MediaType.DOCUMENT),
    ]);
    expect(context.materials[0].text).toBeNull();
    expect(context.prepared.size).toBe(0);
  });

  it('truncates each document and the total sent as context', async () => {
    renderer.inspect.mockResolvedValue({
      text: 'a'.repeat(IDEA_AI.contextCharactersTotal),
      numpages: 1,
    });
    const context = await service.get(
      't',
      'd',
      ['1', '2', '3', '4'].map((id) => media(id, MediaType.DOCUMENT)),
    );
    const sizes = context.materials.map((m) => m.text?.length ?? 0);
    expect(Math.max(...sizes)).toBe(IDEA_AI.contextCharactersPerMaterial);
    expect(sizes.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(
      IDEA_AI.contextCharactersTotal,
    );
  });
});
