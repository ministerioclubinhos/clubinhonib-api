import { Test } from '@nestjs/testing';
import { AppValidationException } from 'src/shared/exceptions';
import {
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { VideosPageController } from './video-page.controller';
import { CreateVideosPageService } from './services/create-video-page.service';
import { UpdateVideosPageService } from './services/update-video-page.service';
import { GetVideosPageService } from './services/get-video-page.service';
import { DeleteVideosPageService } from './services/delete-video-page.service';
import { CreateVideosPageDto } from './dto/create-videos-page.dto';
import { UpdateVideosPageDto } from './dto/update-videos-page.dto';

const ID = 'd41f8e2a-9c3b-4a17-8f5e-1b2c3d4e5f60';

const payload = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    title: 'Galeria de vídeos',
    description: 'Descrição',
    public: true,
    videos: [
      {
        title: 'Vídeo',
        description: '',
        uploadType: UploadType.LINK,
        mediaType: MediaType.VIDEO,
        isLocalFile: false,
        url: 'https://youtube.com/embed/a',
      },
    ],
    ...extra,
  });

describe('VideosPageController', () => {
  const createService = { execute: jest.fn() };
  const updateService = { execute: jest.fn() };
  const getService = { findAllPaginated: jest.fn(), findOne: jest.fn() };
  const deleteService = { execute: jest.fn() };

  let controller: VideosPageController;
  const file = { fieldname: 'video_0' } as Express.Multer.File;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [VideosPageController],
      providers: [
        { provide: CreateVideosPageService, useValue: createService },
        { provide: UpdateVideosPageService, useValue: updateService },
        { provide: GetVideosPageService, useValue: getService },
        { provide: DeleteVideosPageService, useValue: deleteService },
      ],
    }).compile();

    controller = moduleRef.get(VideosPageController);
  });

  it('valida o payload e indexa os arquivos na criação', async () => {
    createService.execute.mockResolvedValue({ id: ID });

    await controller.create([file], payload());

    const [dto, filesDict] = createService.execute.mock.calls[0] as [
      CreateVideosPageDto,
      Record<string, unknown>,
    ];
    expect(dto).toBeInstanceOf(CreateVideosPageDto);
    expect(filesDict).toEqual({ video_0: file });
  });

  it('recusa criação sem o JSON, sem chamar o serviço', async () => {
    await expect(controller.create([], '')).rejects.toBeInstanceOf(
      AppValidationException,
    );
    expect(createService.execute).not.toHaveBeenCalled();
  });

  it('devolve erro de validação, e não erro interno, em payload inválido', async () => {
    // O controller antigo capturava a própria AppValidationException e a
    // devolvia como 500, escondendo o motivo real.
    await expect(
      controller.create([], JSON.stringify({ title: 10 })),
    ).rejects.toBeInstanceOf(AppValidationException);
  });

  it('atualiza usando o id da rota', async () => {
    updateService.execute.mockResolvedValue({ id: ID });

    await controller.update(ID, [file], payload({ id: 'outro' }));

    const [id, dto] = updateService.execute.mock.calls[0] as [
      string,
      UpdateVideosPageDto,
    ];
    expect(id).toBe(ID);
    expect(dto).toBeInstanceOf(UpdateVideosPageDto);
  });

  it('lista páginas repassando os filtros da query', async () => {
    const pagina = {
      data: [{ id: ID }],
      total: 1,
      page: 1,
      limit: 12,
      pageCount: 1,
    };
    getService.findAllPaginated.mockResolvedValue(pagina);
    getService.findOne.mockResolvedValue({ id: ID });

    const query = { page: 1, limit: 12, searchString: 'louvor' };

    await expect(controller.findAll(query)).resolves.toEqual(pagina);
    expect(getService.findAllPaginated).toHaveBeenCalledWith(query);
    await expect(controller.findOne(ID)).resolves.toEqual({ id: ID });
  });

  it('remove a página', async () => {
    await controller.remove(ID);

    expect(deleteService.execute).toHaveBeenCalledWith(ID);
  });
});
