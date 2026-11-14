import { Test } from '@nestjs/testing';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { IdeaAiGatewayProvider } from '../providers/idea-ai-gateway.provider';
import { IdeaDocumentRendererProvider } from '../providers/idea-document-renderer.provider';
import { IdeaImageTransformProvider } from '../providers/idea-image-transform.provider';
import { EnhanceIdeaDocumentService } from './enhance-idea-document.service';
import { EnhanceIdeaImageService } from './enhance-idea-image.service';
import { IdeaEssenceGuardService } from './idea-essence-guard.service';
import { settings, source } from '../testing/fixtures';
import {
  IdeaAiMediaStatus,
  IdeaAiSkipReason,
} from '../enums/ideas-section-ai.enums';
describe('document and image enhancement policies', () => {
  const gateway = { json: jest.fn(), editImage: jest.fn() };
  const s3 = { downloadOwned: jest.fn() };
  const guard = { verify: jest.fn() };
  const renderer = { toPdf: jest.fn(), inspect: jest.fn(), render: jest.fn() };
  const transform = {
    prepare: jest.fn(),
    deterministic: jest.fn(),
    output: jest.fn(),
    compare: jest.fn(),
  };
  let documents: EnhanceIdeaDocumentService;
  let images: EnhanceIdeaImageService;
  const context = { source, settings, imageIndex: 0, instructions: null };
  beforeEach(async () => {
    jest.resetAllMocks();
    const buffer = Buffer.from('file');
    s3.downloadOwned.mockResolvedValue(buffer);
    renderer.toPdf.mockResolvedValue(buffer);
    renderer.inspect.mockResolvedValue({ text: 'Use 3 bolas.', numpages: 2 });
    renderer.render.mockResolvedValue({
      artifact: { buffer, name: 'new.pdf', mimeType: 'application/pdf' },
      editable: { buffer, name: 'new.docx', mimeType: 'application/docx' },
    });
    guard.verify.mockResolvedValue({ approved: true, violations: [] });
    transform.prepare.mockResolvedValue({
      data: buffer,
      name: 'original.png',
      mimeType: 'image/png',
      format: 'png',
      animated: false,
    });
    transform.deterministic.mockResolvedValue(buffer);
    transform.output.mockResolvedValue(buffer);
    transform.compare.mockResolvedValue({ approved: true, violations: [] });
    gateway.editImage.mockResolvedValue(buffer);
    const module = await Test.createTestingModule({
      providers: [
        EnhanceIdeaDocumentService,
        EnhanceIdeaImageService,
        { provide: AwsS3Service, useValue: s3 },
        { provide: IdeaAiGatewayProvider, useValue: gateway },
        { provide: IdeaEssenceGuardService, useValue: guard },
        { provide: IdeaDocumentRendererProvider, useValue: renderer },
        { provide: IdeaImageTransformProvider, useValue: transform },
      ],
    }).compile();
    documents = module.get(EnhanceIdeaDocumentService);
    images = module.get(EnhanceIdeaImageService);
  });
  it('renders PDF and editable DOCX only after the essence judge approves', async () => {
    gateway.json.mockResolvedValue({
      title: '',
      sections: [
        { heading: '', blocks: [{ text: 'Use 3 bolas.', items: [] }] },
      ],
      hasEssentialVisuals: false,
    });
    await expect(documents.enhance(context)).resolves.toMatchObject({
      status: IdeaAiMediaStatus.ENHANCED,
      editable: { name: 'new.docx' },
    });
    expect(renderer.render.mock.invocationCallOrder[0]).toBeGreaterThan(
      guard.verify.mock.invocationCallOrder[0],
    );
  });
  it('rejects a document rewritten into another text before calling the judge', async () => {
    renderer.inspect.mockResolvedValue({
      text: 'Separe bolas coloridas e forme equipes para a gincana do Bom Pastor.',
      numpages: 1,
    });
    gateway.json.mockResolvedValue({
      title: '',
      sections: [
        {
          heading: '',
          blocks: [
            { text: 'Proponha uma dinâmica divertida ao grupo.', items: [] },
          ],
        },
      ],
      hasEssentialVisuals: false,
    });
    await expect(documents.enhance(context)).resolves.toMatchObject({
      status: IdeaAiMediaStatus.REJECTED_BY_GUARD,
      guard: {
        approved: false,
        violations: [expect.stringContaining('afastou demais do original')],
      },
    });
    expect(guard.verify).not.toHaveBeenCalled();
    expect(renderer.render).not.toHaveBeenCalled();
  });
  it('preserves documents with essential drawings and templates', async () => {
    gateway.json.mockResolvedValue({ hasEssentialVisuals: true });
    await expect(documents.enhance(context)).resolves.toMatchObject({
      status: IdeaAiMediaStatus.SKIPPED,
      skipReason: IdeaAiSkipReason.ESSENTIAL_VISUALS,
    });
    expect(renderer.render).not.toHaveBeenCalled();
  });
  it.each([
    { numpages: 31, text: 'text' },
    { numpages: 1, text: 'x'.repeat(60001) },
  ])('checks page/character limits before provider calls', async (parsed) => {
    renderer.inspect.mockResolvedValue(parsed);
    await expect(documents.enhance(context)).resolves.toMatchObject({
      skipReason: IdeaAiSkipReason.TOO_LARGE,
    });
    expect(gateway.json).not.toHaveBeenCalled();
  });
  it('does not generatively edit people, even with quality problems', async () => {
    gateway.json.mockResolvedValue({
      containsPeople: true,
      qualityIssues: ['luz'],
    });
    await images.enhance(context);
    expect(transform.deterministic).toHaveBeenCalled();
    expect(gateway.editImage).not.toHaveBeenCalled();
  });
  it('does not call the provider after the image limit or for legacy links', async () => {
    await expect(
      images.enhance({ ...context, imageIndex: 10 }),
    ).resolves.toMatchObject({ skipReason: IdeaAiSkipReason.LIMIT_REACHED });
    await expect(
      documents.enhance({
        ...context,
        source: { ...source, isLocalFile: false },
      }),
    ).resolves.toMatchObject({ skipReason: IdeaAiSkipReason.NOT_SUPPORTED });
    expect(gateway.json).not.toHaveBeenCalled();
  });
  it('keeps good-quality images and rejects perceptual changes', async () => {
    gateway.json.mockResolvedValue({
      containsPeople: false,
      qualityIssues: [],
    });
    await expect(images.enhance(context)).resolves.toMatchObject({
      skipReason: IdeaAiSkipReason.ALREADY_GOOD,
    });
    gateway.json.mockResolvedValue({
      containsPeople: false,
      qualityIssues: ['luz'],
    });
    transform.compare.mockResolvedValue({
      approved: false,
      violations: ['mudança de proporção'],
    });
    await expect(images.enhance(context)).resolves.toMatchObject({
      status: IdeaAiMediaStatus.REJECTED_BY_GUARD,
    });
    expect(guard.verify).not.toHaveBeenCalled();
  });
});
