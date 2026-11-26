import { Test } from '@nestjs/testing';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { UploadType } from 'src/shared/media/media-item/media-item.entity';
import { PlayAccessService } from 'src/modules/play/services/play-access.service';
import { PlaySubmissionRepository } from '../repositories/play-submission.repository';
import { CreatePlaySubmissionDto } from '../dto/play-submission.dto';
import { CreatePlaySubmissionService } from './create-play-submission.service';

const dto = (overrides: Partial<CreatePlaySubmissionDto> = {}) =>
  Object.assign(new CreatePlaySubmissionDto(), {
    title: '  Meu vídeo ',
    uploadType: UploadType.LINK,
    url: 'https://youtu.be/dQw4w9WgXcQ',
    ...overrides,
  });
const video = {
  mimetype: 'video/mp4',
  size: 10,
  originalname: 'a.mp4',
} as Express.Multer.File;

describe('CreatePlaySubmissionService', () => {
  const repo = { countPendingOf: jest.fn(), create: jest.fn() };
  const s3 = { upload: jest.fn(), delete: jest.fn() };
  const access = { assertSubmissionsEnabled: jest.fn() };
  let service: CreatePlaySubmissionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    access.assertSubmissionsEnabled.mockResolvedValue(undefined);
    repo.countPendingOf.mockResolvedValue(0);
    repo.create.mockImplementation(async (values: object) => ({
      id: 's1',
      createdAt: new Date(),
      reviewedAt: null,
      status: 'pending',
      rejectionReason: null,
      mediaItemId: null,
      ...values,
    }));
    s3.upload.mockImplementation(
      async (file: { originalname?: string }) =>
        `https://s3/${file.originalname ?? 'thumb.jpg'}`,
    );
    s3.delete.mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        CreatePlaySubmissionService,
        { provide: PlaySubmissionRepository, useValue: repo },
        { provide: AwsS3Service, useValue: s3 },
        { provide: PlayAccessService, useValue: access },
      ],
    }).compile();
    service = moduleRef.get(CreatePlaySubmissionService);
  });

  it('grava um link do YouTube como pendente, sem tocar no S3', async () => {
    const result = await service.execute('u1', dto(), undefined, undefined);

    expect(s3.upload).not.toHaveBeenCalled();
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        submittedById: 'u1',
        title: 'Meu vídeo',
        platformType: 'youtube',
        url: 'https://youtu.be/dQw4w9WgXcQ',
      }),
    );
    expect(result.status).toBe('pending');
    expect(result).not.toHaveProperty('submitter');
  });

  it('envia o arquivo e a miniatura ao S3 e guarda os dados do arquivo', async () => {
    const thumb = { mimetype: 'image/jpeg', size: 5 } as Express.Multer.File;

    await service.execute(
      'u1',
      dto({
        uploadType: UploadType.UPLOAD,
        url: undefined,
        durationSeconds: 75,
      }),
      video,
      thumb,
    );

    expect(s3.upload).toHaveBeenCalledTimes(2);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://s3/a.mp4',
        originalName: 'a.mp4',
        thumbnailUrl: 'https://s3/thumb.jpg',
        durationSeconds: 75,
        platformType: null,
      }),
    );
  });

  it('apaga os arquivos do S3 se a gravação falhar depois do upload', async () => {
    repo.create.mockRejectedValue(new Error('db'));

    await expect(
      service.execute(
        'u1',
        dto({ uploadType: UploadType.UPLOAD, url: undefined }),
        video,
        undefined,
      ),
    ).rejects.toBeDefined();

    expect(s3.delete).toHaveBeenCalledWith('https://s3/a.mp4');
  });

  it('limita os envios pendentes por pessoa, antes de subir qualquer arquivo', async () => {
    repo.countPendingOf.mockResolvedValue(10);

    await expect(
      service.execute(
        'u1',
        dto({ uploadType: UploadType.UPLOAD, url: undefined }),
        video,
        undefined,
      ),
    ).rejects.toBeDefined();
    expect(s3.upload).not.toHaveBeenCalled();
  });

  it('respeita a flag de envio', async () => {
    access.assertSubmissionsEnabled.mockRejectedValue(new Error('off'));

    await expect(
      service.execute('u1', dto(), undefined, undefined),
    ).rejects.toThrow('off');
    expect(repo.create).not.toHaveBeenCalled();
  });
});
