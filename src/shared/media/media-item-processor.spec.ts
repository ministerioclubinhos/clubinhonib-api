import { Test } from '@nestjs/testing';
import { AppValidationException } from 'src/shared/exceptions';
import {
  MediaItemEntity,
  MediaType,
  UploadType,
} from './media-item/media-item.entity';
import { MediaItemRepository } from './media-item-repository';
import { MediaItemProcessor, MediaItemInput } from './media-item-processor';

const media = (url: string): MediaItemEntity =>
  Object.assign(new MediaItemEntity(), { id: url, url });

const storedUpload = (
  id: string,
  url: string,
  overrides: Partial<MediaItemEntity> = {},
): MediaItemEntity =>
  Object.assign(new MediaItemEntity(), {
    id,
    url,
    isLocalFile: true,
    originalName: 'antigo.pdf',
    size: 10,
    mediaType: MediaType.DOCUMENT,
    uploadType: UploadType.UPLOAD,
    targetId: 'alvo',
    targetType: 'Meditation',
    ...overrides,
  });

const uploadInput = (
  overrides: Partial<MediaItemInput> = {},
): MediaItemInput => ({
  title: 'Material',
  description: '',
  mediaType: MediaType.DOCUMENT,
  uploadType: UploadType.UPLOAD,
  isLocalFile: true,
  fileField: 'file',
  ...overrides,
});

const file = { originalname: 'novo.pdf', size: 42 } as Express.Multer.File;

describe('MediaItemProcessor.discardUnreferencedUploads', () => {
  const mediaRepo = { findByUrls: jest.fn() };
  let processor: MediaItemProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        MediaItemProcessor,
        { provide: MediaItemRepository, useValue: mediaRepo },
      ],
    }).compile();

    processor = moduleRef.get(MediaItemProcessor);
  });

  it('não consulta nada quando não houve upload', async () => {
    const deleteFn = jest.fn();

    await expect(
      processor.discardUnreferencedUploads([], deleteFn),
    ).resolves.toBe(0);
    expect(mediaRepo.findByUrls).not.toHaveBeenCalled();
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it('apaga do S3 o arquivo que não ficou referenciado', async () => {
    mediaRepo.findByUrls.mockResolvedValue([]);
    const deleteFn = jest.fn().mockResolvedValue(undefined);

    const discarded = await processor.discardUnreferencedUploads(
      ['https://s3/orfao.png'],
      deleteFn,
    );

    expect(discarded).toBe(1);
    expect(deleteFn).toHaveBeenCalledWith('https://s3/orfao.png');
  });

  it('preserva o arquivo de uma mídia já gravada', async () => {
    // Apagar o objeto de um registro que sobreviveu deixaria a mídia apontando
    // para um arquivo inexistente — pior do que manter um órfão.
    mediaRepo.findByUrls.mockResolvedValue([media('https://s3/gravada.png')]);
    const deleteFn = jest.fn();

    const discarded = await processor.discardUnreferencedUploads(
      ['https://s3/gravada.png', 'https://s3/orfao.png'],
      deleteFn,
    );

    expect(discarded).toBe(1);
    expect(deleteFn).toHaveBeenCalledTimes(1);
    expect(deleteFn).toHaveBeenCalledWith('https://s3/orfao.png');
  });

  it('segue descartando os demais quando uma remoção falha', async () => {
    mediaRepo.findByUrls.mockResolvedValue([]);
    const deleteFn = jest
      .fn()
      .mockRejectedValueOnce(new Error('s3 fora do ar'))
      .mockResolvedValueOnce(undefined);

    const discarded = await processor.discardUnreferencedUploads(
      ['https://s3/a.png', 'https://s3/b.png'],
      deleteFn,
    );

    expect(discarded).toBe(2);
    expect(deleteFn).toHaveBeenCalledTimes(2);
  });
});

describe('MediaItemProcessor.cleanAndReplaceMediaItems', () => {
  const mediaRepo = {
    findByUrls: jest.fn(),
    save: jest.fn(),
    saveById: jest.fn(),
    removeMany: jest.fn(),
  };
  let processor: MediaItemProcessor;
  let deleteFn: jest.Mock;
  let uploadFn: jest.Mock;

  const run = (items: MediaItemInput[], oldItems: MediaItemEntity[]) =>
    processor.cleanAndReplaceMediaItems(
      items,
      'alvo',
      'Meditation',
      { file },
      oldItems,
      deleteFn,
      uploadFn,
    );

  beforeEach(async () => {
    jest.clearAllMocks();
    deleteFn = jest.fn().mockResolvedValue(undefined);
    uploadFn = jest.fn().mockResolvedValue('https://s3/novo.pdf');
    mediaRepo.save.mockImplementation((item: MediaItemEntity) =>
      Object.assign(item, { id: item.id ?? 'nova' }),
    );
    mediaRepo.saveById.mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        MediaItemProcessor,
        { provide: MediaItemRepository, useValue: mediaRepo },
      ],
    }).compile();

    processor = moduleRef.get(MediaItemProcessor);
  });

  it('sobe o arquivo novo e grava antes de apagar o antigo', async () => {
    const previous = storedUpload('m1', 'https://s3/antigo.pdf');

    const [saved] = await run([uploadInput({ id: 'm1' })], [previous]);

    expect(saved.url).toBe('https://s3/novo.pdf');
    expect(deleteFn).toHaveBeenCalledWith('https://s3/antigo.pdf');

    const uploadedAt = uploadFn.mock.invocationCallOrder[0];
    const savedAt = mediaRepo.saveById.mock.invocationCallOrder[0];
    const deletedAt = deleteFn.mock.invocationCallOrder[0];
    expect(uploadedAt).toBeLessThan(savedAt);
    expect(savedAt).toBeLessThan(deletedAt);
  });

  it('preserva a linha atualizada pelo id', async () => {
    // A linha antiga e a nova são a mesma: removê-la depois do upsert apagaria
    // o registro que acabou de receber o arquivo novo.
    const previous = storedUpload('m1', 'https://s3/antigo.pdf');

    await run([uploadInput({ id: 'm1' })], [previous]);

    expect(mediaRepo.removeMany).not.toHaveBeenCalled();
  });

  it('não apaga nada quando o upload do substituto falha', async () => {
    const previous = storedUpload('m1', 'https://s3/antigo.pdf');
    uploadFn.mockRejectedValue(new Error('s3 fora do ar'));

    await expect(run([uploadInput({ id: 'm1' })], [previous])).rejects.toThrow(
      's3 fora do ar',
    );

    expect(deleteFn).not.toHaveBeenCalled();
    expect(mediaRepo.removeMany).not.toHaveBeenCalled();
  });

  it('reaproveita o arquivo guardado quando a edição não envia um novo', async () => {
    // O formulário reenvia a mídia sem arquivo quando o usuário só mexeu em
    // outros campos. Tratar isso como item inválido apagava o arquivo atual.
    const previous = storedUpload('m1', 'https://s3/antigo.pdf');

    const [saved] = await processor.cleanAndReplaceMediaItems(
      [uploadInput({ id: 'm1', url: '' })],
      'alvo',
      'Meditation',
      {},
      [previous],
      deleteFn,
      uploadFn,
    );

    expect(uploadFn).not.toHaveBeenCalled();
    expect(saved.url).toBe('https://s3/antigo.pdf');
    expect(saved.originalName).toBe('antigo.pdf');
    expect(deleteFn).not.toHaveBeenCalled();
    expect(mediaRepo.removeMany).not.toHaveBeenCalled();
  });

  it('reaproveita o arquivo guardado mesmo sem o id, pela url', async () => {
    const previous = storedUpload('m1', 'https://s3/antigo.pdf');

    const [saved] = await processor.cleanAndReplaceMediaItems(
      [uploadInput({ url: 'https://s3/antigo.pdf' })],
      'alvo',
      'Meditation',
      {},
      [previous],
      deleteFn,
      uploadFn,
    );

    expect(saved.url).toBe('https://s3/antigo.pdf');
    expect(saved.id).toBe('m1');
    expect(deleteFn).not.toHaveBeenCalled();
    expect(mediaRepo.removeMany).not.toHaveBeenCalled();
  });

  it('recusa upload sem arquivo e sem mídia anterior, sem apagar nada', async () => {
    const outra = storedUpload('m2', 'https://s3/outra.pdf');

    await expect(
      processor.cleanAndReplaceMediaItems(
        [uploadInput({ fileField: 'ausente' })],
        'alvo',
        'Meditation',
        {},
        [outra],
        deleteFn,
        uploadFn,
      ),
    ).rejects.toBeInstanceOf(AppValidationException);

    expect(deleteFn).not.toHaveBeenCalled();
    expect(mediaRepo.removeMany).not.toHaveBeenCalled();
  });

  it('prefere o arquivo novo quando ele é enviado junto da url guardada', async () => {
    const previous = storedUpload('m1', 'https://s3/antigo.pdf');

    const [saved] = await run(
      [uploadInput({ id: 'm1', url: 'https://s3/antigo.pdf' })],
      [previous],
    );

    expect(uploadFn).toHaveBeenCalledWith(file);
    expect(saved.url).toBe('https://s3/novo.pdf');
    expect(deleteFn).toHaveBeenCalledWith('https://s3/antigo.pdf');
  });

  it('troca o upload por link, apagando o arquivo que ficou sem uso', async () => {
    const previous = storedUpload('m1', 'https://s3/antigo.pdf');

    const [saved] = await run(
      [
        uploadInput({
          id: 'm1',
          uploadType: UploadType.LINK,
          isLocalFile: false,
          url: 'https://drive.google.com/a',
        }),
      ],
      [previous],
    );

    expect(saved.url).toBe('https://drive.google.com/a');
    expect(saved.isLocalFile).toBe(false);
    expect(deleteFn).toHaveBeenCalledWith('https://s3/antigo.pdf');
    expect(mediaRepo.removeMany).not.toHaveBeenCalled();
  });

  it('remove linha e arquivo da mídia que saiu da substituição', async () => {
    const dropped = storedUpload('m2', 'https://s3/saiu.pdf');
    const previous = storedUpload('m1', 'https://s3/antigo.pdf');

    await run([uploadInput({ id: 'm1' })], [previous, dropped]);

    expect(mediaRepo.removeMany).toHaveBeenCalledWith([dropped]);
    expect(deleteFn).toHaveBeenCalledWith('https://s3/saiu.pdf');
    expect(deleteFn).toHaveBeenCalledWith('https://s3/antigo.pdf');
  });

  it('não apaga do S3 a mídia antiga que era apenas um link', async () => {
    const link = storedUpload('m2', 'https://youtube.com/watch?v=a', {
      isLocalFile: false,
      uploadType: UploadType.LINK,
    });

    await run(
      [uploadInput({ uploadType: UploadType.LINK, url: 'https://outro.com' })],
      [link],
    );

    expect(deleteFn).not.toHaveBeenCalled();
    expect(mediaRepo.removeMany).toHaveBeenCalledWith([link]);
  });

  it('conclui a substituição mesmo se a remoção no S3 falhar', async () => {
    const previous = storedUpload('m1', 'https://s3/antigo.pdf');
    deleteFn.mockRejectedValue(new Error('s3 fora do ar'));

    const [saved] = await run([uploadInput({ id: 'm1' })], [previous]);

    expect(saved.url).toBe('https://s3/novo.pdf');
  });
});
