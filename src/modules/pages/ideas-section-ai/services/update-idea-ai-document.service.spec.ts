import { AppException } from 'src/shared/exceptions';
import { ErrorCode } from 'src/shared/exceptions';
import { UpdateIdeaAiDocumentService } from './update-idea-ai-document.service';
import {
  IdeaAiEnhancementStatus,
  IdeaAiMediaKind,
  IdeaAiMediaStatus,
} from '../enums/ideas-section-ai.enums';
import type { IdeaTiptapDocument } from '../types';

const SECTION = 'section-1';
const SOURCE = 'source-1';
const ATTEMPT = 'attempt-1';
const document: IdeaTiptapDocument = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Texto editado' }] },
  ],
};
const result = (overrides: Record<string, unknown> = {}) => ({
  id: 'result-1',
  kind: IdeaAiMediaKind.DOCUMENT,
  status: IdeaAiMediaStatus.ENHANCED,
  sourceMedia: { title: 'Ideia' },
  enhancedMedia: {
    id: 'old-pdf',
    url: 'https://s3/old.pdf',
    isLocalFile: true,
  },
  editableMedia: {
    id: 'old-docx',
    url: 'https://s3/old.docx',
    isLocalFile: true,
  },
  ...overrides,
});

function setup(
  options: {
    references?: number;
    published?: boolean;
    active?: boolean;
    currentId?: string;
    transactionError?: Error;
  } = {},
) {
  const manager = {};
  const repo = {
    currentAttempt: jest
      .fn()
      .mockResolvedValue({ id: options.currentId ?? ATTEMPT }),
    mediaResult: jest.fn().mockResolvedValue(result()),
    lockSection: jest.fn().mockResolvedValue({
      id: SECTION,
      page: options.published ? { id: 'p' } : null,
    }),
    attempts: jest
      .fn()
      .mockResolvedValue(
        options.active ? [{ status: IdeaAiEnhancementStatus.PROCESSING }] : [],
      ),
    mediaReferences: jest.fn().mockResolvedValue(options.references ?? 0),
    updateMediaResult: jest.fn().mockResolvedValue(undefined),
    transaction: jest.fn(async (work: (m: unknown) => Promise<unknown>) => {
      if (options.transactionError) throw options.transactionError;
      return work(manager);
    }),
  };
  const renderer = {
    renderTiptap: jest.fn().mockResolvedValue({
      artifact: {
        buffer: Buffer.from('pdf'),
        name: 'ideia-melhorada.pdf',
        mimeType: 'application/pdf',
      },
      editable: {
        buffer: Buffer.from('docx'),
        name: 'ideia-melhorada.docx',
        mimeType: 'application/docx',
      },
      document,
    }),
  };
  let created = 0;
  const media = {
    saveMediaItemInTransaction: jest.fn(() =>
      Promise.resolve({ id: `new-${++created}` }),
    ),
    deleteMediaItemByIdInTransaction: jest.fn().mockResolvedValue(undefined),
    discardUnreferencedUploads: jest.fn().mockResolvedValue(0),
  };
  let uploaded = 0;
  const s3 = {
    upload: jest.fn(() => Promise.resolve(`https://s3/new-${++uploaded}`)),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const service = new UpdateIdeaAiDocumentService(
    repo as never,
    renderer as never,
    media as never,
    s3 as never,
  );
  return { service, repo, renderer, media, s3 };
}

const save = (service: UpdateIdeaAiDocumentService, enhancementId = ATTEMPT) =>
  service.save(SECTION, SOURCE, { enhancementId, document });

describe('UpdateIdeaAiDocumentService', () => {
  it('replaces the files, keeps the JSON and discards the old ones only after commit', async () => {
    const { service, repo, media } = setup();
    const response = await save(service);

    expect(repo.updateMediaResult).toHaveBeenCalledWith(
      'result-1',
      expect.objectContaining({
        enhancedMediaId: 'new-1',
        editableMediaId: 'new-2',
        editableDocumentJson: document,
      }),
      expect.anything(),
    );
    expect(media.deleteMediaItemByIdInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      'old-pdf',
    );
    expect(media.deleteMediaItemByIdInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      'old-docx',
    );
    expect(media.discardUnreferencedUploads).toHaveBeenLastCalledWith(
      ['https://s3/old.pdf', 'https://s3/old.docx'],
      expect.any(Function),
    );
    expect(response).toMatchObject({
      enhancementId: ATTEMPT,
      sourceMediaId: SOURCE,
    });
    expect(response.editedAt).toEqual(expect.any(String));
  });

  it('keeps old files that another attempt still uses (carried-over result)', async () => {
    const { service, media } = setup({ references: 1 });
    await save(service);
    expect(media.deleteMediaItemByIdInTransaction).not.toHaveBeenCalled();
    expect(media.discardUnreferencedUploads).toHaveBeenLastCalledWith(
      [],
      expect.any(Function),
    );
  });

  it('discards the freshly uploaded files when the transaction fails', async () => {
    const { service, media } = setup({
      transactionError: new Error('db down'),
    });
    await expect(save(service)).rejects.toThrow('db down');
    expect(media.discardUnreferencedUploads).toHaveBeenCalledWith(
      ['https://s3/new-1', 'https://s3/new-2'],
      expect.any(Function),
    );
    expect(media.deleteMediaItemByIdInTransaction).not.toHaveBeenCalled();
  });

  it('refuses an invalid document before rendering or uploading anything', async () => {
    const { service, renderer, s3 } = setup();
    const error = await service
      .save(SECTION, SOURCE, {
        enhancementId: ATTEMPT,
        document: { type: 'doc', content: [{ type: 'script' }] },
      })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppException);
    expect(renderer.renderTiptap).not.toHaveBeenCalled();
    expect(s3.upload).not.toHaveBeenCalled();
  });

  it('answers 409 when the on-screen attempt is no longer the current one', async () => {
    const { service, renderer } = setup({ currentId: 'other-attempt' });
    await expect(save(service)).rejects.toMatchObject({
      code: ErrorCode.IDEA_AI_STALE_DECISIONS,
    });
    expect(renderer.renderTiptap).not.toHaveBeenCalled();
  });

  it('refuses a published idea and cleans up the files already rendered', async () => {
    const { service, media, repo } = setup({ published: true });
    await expect(save(service)).rejects.toMatchObject({
      code: ErrorCode.IDEA_AI_ALREADY_PUBLISHED,
    });
    expect(repo.updateMediaResult).not.toHaveBeenCalled();
    expect(media.discardUnreferencedUploads).toHaveBeenCalledWith(
      ['https://s3/new-1', 'https://s3/new-2'],
      expect.any(Function),
    );
  });

  it('refuses while the AI is still working', async () => {
    const { service } = setup({ active: true });
    await expect(save(service)).rejects.toMatchObject({
      code: ErrorCode.IDEA_AI_ENHANCEMENT_IN_PROGRESS,
    });
  });
});
