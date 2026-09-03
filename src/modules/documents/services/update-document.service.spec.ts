import { Test } from '@nestjs/testing';
import { DataSource, EntityManager } from 'typeorm';
import {
  AppInternalException,
  AppNotFoundException,
  AppValidationException,
} from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import {
  MediaItemEntity,
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { RouteService } from 'src/modules/routes/route.service';
import { DocumentsRepository } from '../repositories/documents.repository';
import { DocumentEntity } from '../entities/document.entity';
import { UpdateDocumentService } from './update-document.service';

const storedMedia = Object.assign(new MediaItemEntity(), {
  id: 'media-1',
  url: 'https://s3/antigo.pdf',
  isLocalFile: true,
  originalName: 'antigo.pdf',
  size: 10,
  targetId: 'doc-1',
  targetType: 'document',
});

const buildDocument = (): DocumentEntity =>
  Object.assign(new DocumentEntity(), {
    id: 'doc-1',
    name: 'Manual',
    description: 'Descrição',
    route: { id: 'route-1' },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  });

const dto = (media: Record<string, unknown> = {}) =>
  ({
    id: 'doc-1',
    name: 'Manual revisado',
    description: 'Nova descrição',
    media: {
      id: 'media-1',
      title: 'Manual',
      description: '',
      mediaType: MediaType.DOCUMENT,
      uploadType: UploadType.UPLOAD,
      isLocalFile: true,
      // O formulário reenvia a mídia sem url quando o arquivo não muda.
      url: '',
      fileField: 'file',
      ...media,
    },
  }) as never;

describe('UpdateDocumentService', () => {
  const manager = {
    merge: jest.fn((_entity: unknown, target: object, extra: object) =>
      Object.assign(target, extra),
    ),
    save: jest.fn((_entity: unknown, value: unknown) => value),
  } as unknown as EntityManager;

  const dataSource = {
    transaction: jest.fn((run: (m: EntityManager) => Promise<unknown>) =>
      run(manager),
    ),
  };
  const documentRepo = { findByIdWithRoute: jest.fn() };
  const s3Service = { upload: jest.fn(), delete: jest.fn() };
  const mediaProcessor = {
    findMediaItemsByTargetAnyType: jest.fn(),
    cleanAndReplaceMediaItems: jest.fn(),
    discardUnreferencedUploads: jest.fn(),
  };
  const routeService = { upsertRouteWithAvailablePath: jest.fn() };

  let service: UpdateDocumentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    documentRepo.findByIdWithRoute.mockResolvedValue(buildDocument());
    mediaProcessor.findMediaItemsByTargetAnyType.mockResolvedValue([
      storedMedia,
    ]);
    mediaProcessor.cleanAndReplaceMediaItems.mockResolvedValue([storedMedia]);
    routeService.upsertRouteWithAvailablePath.mockResolvedValue({
      id: 'route-1',
      path: 'documento_manual_revisado',
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        UpdateDocumentService,
        { provide: DataSource, useValue: dataSource },
        { provide: DocumentsRepository, useValue: documentRepo },
        { provide: AwsS3Service, useValue: s3Service },
        { provide: MediaItemProcessor, useValue: mediaProcessor },
        { provide: RouteService, useValue: routeService },
      ],
    }).compile();

    service = moduleRef.get(UpdateDocumentService);
  });

  it('atualiza os campos do documento e a rota', async () => {
    const saved = await service.execute('doc-1', dto());

    expect(saved.name).toBe('Manual revisado');
    // `path` é único: a rota precisa de um endereço livre, e não de um gerado
    // direto do título.
    expect(routeService.upsertRouteWithAvailablePath).toHaveBeenCalledWith(
      'route-1',
      expect.objectContaining({ title: 'Manual revisado' }),
      'documento_',
    );
  });

  it('responde no contrato, com a mídia já sincronizada', async () => {
    const saved = await service.execute('doc-1', dto());

    expect(Object.keys(saved).sort()).toEqual([
      'createdAt',
      'description',
      'id',
      'media',
      'name',
      'updatedAt',
    ]);
    expect(saved.media?.id).toBe('media-1');
  });

  it('procura a mídia pelas duas grafias antigas do targetType', async () => {
    // A criação gravava `Document` e a edição antiga gravava `document`:
    // procurar só por uma delas escondia a mídia e deixava o arquivo órfão.
    await service.execute('doc-1', dto());

    expect(mediaProcessor.findMediaItemsByTargetAnyType).toHaveBeenCalledWith(
      'doc-1',
      ['Document', 'document'],
    );
  });

  it('delega a substituição da mídia, preservando o id da atual', async () => {
    await service.execute('doc-1', dto({ id: undefined }));

    const [items, targetId, targetType] = mediaProcessor
      .cleanAndReplaceMediaItems.mock.calls[0] as [
      Record<string, unknown>[],
      string,
      string,
    ];
    expect(items).toEqual([expect.objectContaining({ id: 'media-1' })]);
    expect(targetId).toBe('doc-1');
    expect(targetType).toBe('Document');
  });

  it('mantém a URL guardada quando a edição não envia arquivo novo', async () => {
    // O caminho manual que existia aqui gravava `url: ""` nesse caso e o
    // documento ficava sem link nenhum.
    await service.execute('doc-1', dto());

    expect(s3Service.delete).not.toHaveBeenCalled();
    const [items] = mediaProcessor.cleanAndReplaceMediaItems.mock.calls[0] as [
      Record<string, unknown>[],
    ];
    expect(items[0].url).toBe('');
    // Quem decide reaproveitar é o processador, que recebe a mídia atual.
    const [, , , , oldItems] = mediaProcessor.cleanAndReplaceMediaItems.mock
      .calls[0] as [unknown, unknown, unknown, unknown, MediaItemEntity[]];
    expect(oldItems).toEqual([storedMedia]);
  });

  it('entrega o arquivo enviado ao processador', async () => {
    const file = { originalname: 'novo.pdf', size: 42 } as Express.Multer.File;

    await service.execute('doc-1', dto(), file);

    const [, , , filesDict] = mediaProcessor.cleanAndReplaceMediaItems.mock
      .calls[0] as [unknown, unknown, unknown, Record<string, unknown>];
    expect(filesDict).toEqual({ file });
  });

  it('descarta do S3 o arquivo enviado quando a atualização falha', async () => {
    s3Service.upload.mockResolvedValue('https://s3/novo.pdf');
    mediaProcessor.cleanAndReplaceMediaItems.mockImplementation(
      async (
        _items: unknown,
        _targetId: string,
        _targetType: string,
        _filesDict: unknown,
        _old: unknown,
        _deleteFn: unknown,
        uploadFn: (f: Express.Multer.File) => Promise<string>,
      ) => {
        await uploadFn({ originalname: 'novo.pdf' } as Express.Multer.File);
        throw new Error('db down');
      },
    );

    await expect(service.execute('doc-1', dto())).rejects.toBeInstanceOf(
      AppInternalException,
    );

    expect(mediaProcessor.discardUnreferencedUploads).toHaveBeenCalledWith(
      ['https://s3/novo.pdf'],
      expect.any(Function),
    );
  });

  it('falha quando o documento não existe', async () => {
    documentRepo.findByIdWithRoute.mockResolvedValue(null);

    await expect(service.execute('x', dto())).rejects.toBeInstanceOf(
      AppNotFoundException,
    );
  });

  it('exige os dados da mídia', async () => {
    await expect(
      service.execute('doc-1', { id: 'doc-1', name: 'X' } as never),
    ).rejects.toBeInstanceOf(AppValidationException);
  });
});
