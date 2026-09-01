import { Test } from '@nestjs/testing';
import { Request } from 'express';
import { AppValidationException } from 'src/shared/exceptions';
import {
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { AuthContextService } from 'src/core/auth/services/auth-context.service';
import { ImageController } from './image-page.controller';
import { ImagePageCreateService } from './services/create-image-page.service';
import { ImagePageGetService } from './services/get-image-page.service';
import { ImagePageUpdateService } from './services/update-image-page.service';
import { ImagePageDeleteService } from './services/delete-image-page.service';
import { CreateImagePageDto } from './dto/create-image.dto';
import { QueryImageSectionsDto } from './dto/query-image-sections.dto';

const ID = 'a3b1f0c8-1d2e-4f5a-9b7c-2e6d4f8a1b30';

const payload = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    title: 'Galeria de fotos',
    description: 'Fotos do evento',
    public: true,
    sections: [
      {
        caption: 'Abertura',
        description: 'Fotos da abertura',
        public: true,
        mediaItems: [
          {
            title: 'Foto',
            description: '',
            mediaType: MediaType.IMAGE,
            uploadType: UploadType.LINK,
            isLocalFile: false,
            url: 'https://example.com/a.png',
          },
        ],
      },
    ],
    ...extra,
  });

describe('ImageController', () => {
  const createService = { createImagePage: jest.fn() };
  const updateService = { updateImagePage: jest.fn() };
  const deleteService = { removePage: jest.fn() };
  const getService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findSectionsPaginated: jest.fn(),
  };
  const authContext = { isLoggedIn: jest.fn() };

  let controller: ImageController;
  const file = { fieldname: 'image_0' } as Express.Multer.File;
  const request = {} as Request;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [ImageController],
      providers: [
        { provide: ImagePageCreateService, useValue: createService },
        { provide: ImagePageGetService, useValue: getService },
        { provide: ImagePageUpdateService, useValue: updateService },
        { provide: ImagePageDeleteService, useValue: deleteService },
        { provide: AuthContextService, useValue: authContext },
      ],
    }).compile();

    controller = moduleRef.get(ImageController);
  });

  it('valida o payload e indexa os arquivos na criação', async () => {
    createService.createImagePage.mockResolvedValue({ id: ID });

    await controller.create([file], payload());

    const [dto, filesDict] = createService.createImagePage.mock.calls[0] as [
      CreateImagePageDto,
      Record<string, unknown>,
    ];
    expect(dto).toBeInstanceOf(CreateImagePageDto);
    expect(filesDict).toEqual({ image_0: file });
  });

  it('recusa criação sem o JSON, sem chamar o serviço', async () => {
    await expect(controller.create([], '')).rejects.toBeInstanceOf(
      AppValidationException,
    );
    expect(createService.createImagePage).not.toHaveBeenCalled();
  });

  it('devolve erro de validação, e não erro interno, em payload inválido', async () => {
    // O controller antigo transformava qualquer falha em 500, escondendo o
    // motivo real de quem preenchia o formulário.
    await expect(
      controller.create([], JSON.stringify({ title: 10 })),
    ).rejects.toBeInstanceOf(AppValidationException);
  });

  it('atualiza usando o id da rota', async () => {
    updateService.updateImagePage.mockResolvedValue({ id: ID });

    await controller.update(ID, [file], payload({ id: 'outro' }));

    const [id] = updateService.updateImagePage.mock.calls[0] as [string];
    expect(id).toBe(ID);
  });

  it('resolve a visibilidade da sessão antes de paginar as seções', async () => {
    authContext.isLoggedIn.mockResolvedValue(true);
    getService.findSectionsPaginated.mockResolvedValue({ sections: [] });
    const query = Object.assign(new QueryImageSectionsDto(), {
      page: 1,
      limit: 2,
    });

    await controller.getPaginatedSections(ID, query, request);

    expect(authContext.isLoggedIn).toHaveBeenCalledWith(request);
    expect(getService.findSectionsPaginated).toHaveBeenCalledWith(
      ID,
      query,
      true,
    );
  });

  it('esconde seções privadas de quem não está logado', async () => {
    authContext.isLoggedIn.mockResolvedValue(false);
    getService.findSectionsPaginated.mockResolvedValue({ sections: [] });

    await controller.getPaginatedSections(
      ID,
      new QueryImageSectionsDto(),
      request,
    );

    expect(getService.findSectionsPaginated).toHaveBeenCalledWith(
      ID,
      expect.anything(),
      false,
    );
  });

  it('lista e busca galerias', async () => {
    getService.findAll.mockResolvedValue([{ id: ID }]);
    getService.findOne.mockResolvedValue({ id: ID });

    await expect(controller.findAll()).resolves.toEqual([{ id: ID }]);
    await expect(controller.findOne(ID)).resolves.toEqual({ id: ID });
  });

  it('remove a galeria', async () => {
    await controller.remove(ID);

    expect(deleteService.removePage).toHaveBeenCalledWith(ID);
  });
});
