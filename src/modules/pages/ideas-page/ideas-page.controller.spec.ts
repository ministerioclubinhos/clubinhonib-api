import { Test } from '@nestjs/testing';
import { AppValidationException } from 'src/shared/exceptions';
import {
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { IdeasPageController } from './ideas-page.controller';
import { IdeasPageCreateService } from './services/create-ideas-page.service';
import { IdeasPageGetService } from './services/get-ideas-page.service';
import { IdeasPageUpdateService } from './services/update-ideas-page.service';
import { IdeasPageDeleteService } from './services/delete-ideas-page.service';
import { CreateIdeasPageDto } from './dto/create-ideas-page.dto';
import { UpdateIdeasPageDto } from './dto/update-ideas-page.dto';

const ID = 'a3b1f0c8-1d2e-4f5a-9b7c-2e6d4f8a1b30';

const payload = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    title: 'Página de ideias',
    description: 'Ideias para o clubinho',
    sections: [
      {
        title: 'Abertura',
        description: 'Materiais da abertura',
        medias: [
          {
            title: 'Vídeo',
            description: '',
            mediaType: MediaType.VIDEO,
            uploadType: UploadType.LINK,
            isLocalFile: false,
            url: 'https://example.com/v',
          },
        ],
      },
    ],
    ...extra,
  });

describe('IdeasPageController', () => {
  const createService = { createIdeasPage: jest.fn() };
  const updateService = { updateIdeasPage: jest.fn() };
  const deleteService = { removePage: jest.fn() };
  const getService = { findAllPaginated: jest.fn(), findOne: jest.fn() };

  let controller: IdeasPageController;
  const file = { fieldname: 'video_0_0.mp4' } as Express.Multer.File;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [IdeasPageController],
      providers: [
        { provide: IdeasPageCreateService, useValue: createService },
        { provide: IdeasPageGetService, useValue: getService },
        { provide: IdeasPageUpdateService, useValue: updateService },
        { provide: IdeasPageDeleteService, useValue: deleteService },
      ],
    }).compile();

    controller = moduleRef.get(IdeasPageController);
  });

  it('valida o payload e indexa os arquivos na criação', async () => {
    createService.createIdeasPage.mockResolvedValue({ id: ID });

    await controller.create([file], payload());

    const [dto, filesDict] = createService.createIdeasPage.mock.calls[0] as [
      CreateIdeasPageDto,
      Record<string, unknown>,
    ];
    expect(dto).toBeInstanceOf(CreateIdeasPageDto);
    expect(filesDict).toEqual({ 'video_0_0.mp4': file });
  });

  it('recusa criação sem o JSON, sem chamar o serviço', async () => {
    await expect(controller.create([], '')).rejects.toBeInstanceOf(
      AppValidationException,
    );
    expect(createService.createIdeasPage).not.toHaveBeenCalled();
  });

  it('devolve erro de validação, e não erro interno, em payload inválido', async () => {
    // O controller antigo transformava qualquer falha em 500, escondendo o
    // motivo real de quem preenchia o formulário.
    await expect(
      controller.create([], JSON.stringify({ title: 10 })),
    ).rejects.toBeInstanceOf(AppValidationException);
  });

  it('atualiza usando o id da rota, não o id do corpo', async () => {
    updateService.updateIdeasPage.mockResolvedValue({ id: ID });

    await controller.update(ID, [file], payload({ id: 'outro' }));

    const [id, dto] = updateService.updateIdeasPage.mock.calls[0] as [
      string,
      UpdateIdeasPageDto,
    ];
    expect(id).toBe(ID);
    expect(dto).toBeInstanceOf(UpdateIdeasPageDto);
  });

  it('aceita edição de mídia já gravada, que chega sem fieldKey', async () => {
    updateService.updateIdeasPage.mockResolvedValue({ id: ID });

    await controller.update(
      ID,
      [],
      payload({
        sections: [
          {
            id: 'section-id',
            title: 'Abertura',
            description: '',
            medias: [
              {
                id: 'media-id',
                title: 'Foto',
                description: '',
                mediaType: MediaType.IMAGE,
                uploadType: UploadType.UPLOAD,
                isLocalFile: true,
                url: 'https://s3/a.png',
              },
            ],
          },
        ],
      }),
    );

    expect(updateService.updateIdeasPage).toHaveBeenCalledTimes(1);
  });

  it('lista páginas de ideias repassando os filtros da query', async () => {
    const pagina = {
      data: [{ id: ID }],
      total: 1,
      page: 1,
      limit: 12,
      pageCount: 1,
    };
    getService.findAllPaginated.mockResolvedValue(pagina);
    getService.findOne.mockResolvedValue({ id: ID });

    const query = { page: 1, limit: 12, searchString: 'brincadeira' };

    await expect(controller.findAll(query)).resolves.toEqual(pagina);
    expect(getService.findAllPaginated).toHaveBeenCalledWith(query);
    await expect(controller.findOne(ID)).resolves.toEqual({ id: ID });
  });

  it('remove a página de ideias', async () => {
    await controller.remove(ID);

    expect(deleteService.removePage).toHaveBeenCalledWith(ID);
  });
});
