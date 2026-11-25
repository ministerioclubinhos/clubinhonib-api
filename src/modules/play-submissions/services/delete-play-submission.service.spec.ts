import { Test } from '@nestjs/testing';
import {
  AppConflictException,
  AppNotFoundException,
} from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { PlaySubmissionRepository } from '../repositories/play-submission.repository';
import { PlaySubmissionStatus } from '../enums/play-submission-status.enum';
import { DeletePlaySubmissionService } from './delete-play-submission.service';

describe('DeletePlaySubmissionService', () => {
  const repo = { findById: jest.fn(), remove: jest.fn() };
  const s3 = { delete: jest.fn() };
  let service: DeletePlaySubmissionService;
  const own = (overrides: object = {}) => ({
    id: 's1',
    submittedById: 'u1',
    status: PlaySubmissionStatus.PENDING,
    uploadType: 'upload',
    url: 'https://s3/v.mp4',
    thumbnailUrl: 'https://s3/t.jpg',
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    s3.delete.mockResolvedValue(undefined);
    repo.findById.mockResolvedValue(own());
    const moduleRef = await Test.createTestingModule({
      providers: [
        DeletePlaySubmissionService,
        { provide: PlaySubmissionRepository, useValue: repo },
        { provide: AwsS3Service, useValue: s3 },
      ],
    }).compile();
    service = moduleRef.get(DeletePlaySubmissionService);
  });

  it('o autor retira o envio pendente e os arquivos saem do S3', async () => {
    await service.withdraw('u1', 's1');

    expect(repo.remove).toHaveBeenCalled();
    expect(s3.delete).toHaveBeenCalledTimes(2);
  });

  it('envio de outra pessoa parece inexistente', async () => {
    await expect(service.withdraw('outro', 's1')).rejects.toBeInstanceOf(
      AppNotFoundException,
    );
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it('não retira o que já foi decidido', async () => {
    repo.findById.mockResolvedValue(
      own({ status: PlaySubmissionStatus.APPROVED }),
    );

    await expect(service.withdraw('u1', 's1')).rejects.toBeInstanceOf(
      AppConflictException,
    );
  });

  it('falha ao apagar do S3 não derruba a retirada', async () => {
    s3.delete.mockRejectedValue(new Error('s3'));

    await expect(service.withdraw('u1', 's1')).resolves.toBeUndefined();
  });
});
