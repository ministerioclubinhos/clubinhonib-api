import { Test } from '@nestjs/testing';
import { AppValidationException } from 'src/shared/exceptions';
import {
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { WeekMaterialsPageController } from './week-material-page.controller';
import { WeekMaterialsPageCreateService } from './services/create-week-material.service';
import { WeekMaterialsPageUpdateService } from './services/update-week-material.service';
import { WeekMaterialsPageGetService } from './services/get-week-material.service';
import { WeekMaterialsPageRemoveService } from './services/delete-week-material.service';
import { CreateWeekMaterialsPageDto } from './dto/create-week-material.dto';
import { UpdateWeekMaterialsPageDto } from './dto/update-week-material.dto';

const PAGE_ID = '3f6e2f1a-1f2b-4d0c-9f19-2f5a1f1c9a11';

const payload = (extra: Record<string, unknown> = {}): string =>
  JSON.stringify({
    pageTitle: 'Semana 1',
    pageSubtitle: 'Tema',
    pageDescription: 'Descrição',
    videos: [
      {
        title: 'Vídeo',
        description: 'Desc',
        uploadType: UploadType.UPLOAD,
        mediaType: MediaType.VIDEO,
        isLocalFile: true,
        fieldKey: 'video_0',
      },
    ],
    ...extra,
  });

describe('WeekMaterialsPageController', () => {
  const createService = { createWeekMaterialsPage: jest.fn() };
  const updateService = {
    updateWeekMaterialsPage: jest.fn(),
    setCurrentWeek: jest.fn(),
  };
  const removeService = { removeWeekMaterial: jest.fn() };
  const getService = {
    findAllPaginated: jest.fn(),
    findPageWithMedia: jest.fn(),
    getCurrentWeek: jest.fn(),
  };

  let controller: WeekMaterialsPageController;

  const file = {
    fieldname: 'video_0',
    originalname: 'v.mp4',
    size: 10,
  } as Express.Multer.File;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [WeekMaterialsPageController],
      providers: [
        { provide: WeekMaterialsPageCreateService, useValue: createService },
        { provide: WeekMaterialsPageUpdateService, useValue: updateService },
        { provide: WeekMaterialsPageRemoveService, useValue: removeService },
        { provide: WeekMaterialsPageGetService, useValue: getService },
      ],
    }).compile();

    controller = moduleRef.get(WeekMaterialsPageController);
  });

  describe('create', () => {
    it('validates the payload and forwards the indexed files', async () => {
      createService.createWeekMaterialsPage.mockResolvedValue({ id: PAGE_ID });

      await controller.create([file], payload());

      const [dto, filesDict] = createService.createWeekMaterialsPage.mock
        .calls[0] as [CreateWeekMaterialsPageDto, Record<string, unknown>];
      expect(dto).toBeInstanceOf(CreateWeekMaterialsPageDto);
      expect(filesDict).toEqual({ video_0: file });
    });

    it('rejects a request without the JSON payload', async () => {
      await expect(controller.create([], '')).rejects.toBeInstanceOf(
        AppValidationException,
      );
      expect(createService.createWeekMaterialsPage).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('delegates to the update service with the route id', async () => {
      updateService.updateWeekMaterialsPage.mockResolvedValue({ id: PAGE_ID });

      await controller.update(PAGE_ID, [file], payload({ id: PAGE_ID }));

      const [id, dto, filesDict] = updateService.updateWeekMaterialsPage.mock
        .calls[0] as [
        string,
        UpdateWeekMaterialsPageDto,
        Record<string, unknown>,
      ];
      expect(id).toBe(PAGE_ID);
      expect(dto).toBeInstanceOf(UpdateWeekMaterialsPageDto);
      expect(filesDict).toEqual({ video_0: file });
    });

    it('rejects an invalid payload', async () => {
      await expect(
        controller.update(PAGE_ID, [], JSON.stringify({ pageTitle: 10 })),
      ).rejects.toBeInstanceOf(AppValidationException);
    });
  });

  describe('read endpoints', () => {
    it('lists pages passing the query filters through', async () => {
      const pagina = {
        data: [{ id: PAGE_ID }],
        total: 1,
        page: 1,
        limit: 12,
        pageCount: 1,
      };
      getService.findAllPaginated.mockResolvedValue(pagina);

      const query = { page: 1, limit: 12, currentWeek: true };

      await expect(controller.findAll(query)).resolves.toEqual(pagina);
      expect(getService.findAllPaginated).toHaveBeenCalledWith(query);
    });

    it('returns a single page', async () => {
      getService.findPageWithMedia.mockResolvedValue({ id: PAGE_ID });

      await expect(controller.findOne(PAGE_ID)).resolves.toEqual({
        id: PAGE_ID,
      });
    });

    it('returns null when no page is published for the week', async () => {
      getService.getCurrentWeek.mockResolvedValue(null);

      await expect(controller.getCurrentWeek()).resolves.toBeNull();
    });
  });

  describe('write endpoints', () => {
    it('removes a page', async () => {
      await controller.remove(PAGE_ID);

      expect(removeService.removeWeekMaterial).toHaveBeenCalledWith(PAGE_ID);
    });

    it('publishes a page as the current week material', async () => {
      updateService.setCurrentWeek.mockResolvedValue({ id: PAGE_ID });

      await expect(controller.setCurrentWeek(PAGE_ID)).resolves.toEqual({
        id: PAGE_ID,
      });
    });
  });
});
