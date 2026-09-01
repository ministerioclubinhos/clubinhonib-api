import { Test } from '@nestjs/testing';
import { AppValidationException } from 'src/shared/exceptions';
import {
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { MeditationController } from './meditation.controller';
import { CreateMeditationService } from './services/create-meditation.service';
import { UpdateMeditationService } from './services/update-meditation.service';
import { DeleteMeditationService } from './services/delete-meditation.service';
import { GetMeditationService } from './services/get-meditation.service';
import { CreateMeditationDto } from './dto/create-meditation.dto';
import { UpdateMeditationDto } from './dto/update-meditation.dto';
import { WeekDay } from './entities/day.entity';

const ID = '6f1d2f7c-8f2b-4a1c-9c19-2f5a1f1c9a11';

const payload = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    topic: 'Semana da gratidão',
    startDate: '2026-08-31',
    endDate: '2026-09-04',
    media: {
      title: 'Material',
      description: 'PDF',
      mediaType: MediaType.DOCUMENT,
      uploadType: UploadType.LINK,
      isLocalFile: false,
      url: 'https://drive.google.com/file/d/1/view',
    },
    days: [
      WeekDay.Monday,
      WeekDay.Tuesday,
      WeekDay.Wednesday,
      WeekDay.Thursday,
      WeekDay.Friday,
    ].map((day) => ({ day, verse: 'Sl 1', topic: 'Tema' })),
    ...extra,
  });

describe('MeditationController', () => {
  const createService = { create: jest.fn() };
  const updateService = { update: jest.fn() };
  const deleteService = { remove: jest.fn() };
  const getService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    getThisWeekMeditation: jest.fn(),
  };

  let controller: MeditationController;
  const file = { originalname: 'a.pdf', size: 10 } as Express.Multer.File;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [MeditationController],
      providers: [
        { provide: CreateMeditationService, useValue: createService },
        { provide: UpdateMeditationService, useValue: updateService },
        { provide: DeleteMeditationService, useValue: deleteService },
        { provide: GetMeditationService, useValue: getService },
      ],
    }).compile();

    controller = moduleRef.get(MeditationController);
  });

  it('valida o payload e repassa o arquivo na criação', async () => {
    createService.create.mockResolvedValue({ id: ID });

    await controller.create(file, payload());

    const [dto, sentFile] = createService.create.mock.calls[0] as [
      CreateMeditationDto,
      Express.Multer.File,
    ];
    expect(dto).toBeInstanceOf(CreateMeditationDto);
    expect(sentFile).toBe(file);
  });

  it('recusa criação sem o JSON', async () => {
    await expect(controller.create(file, '')).rejects.toBeInstanceOf(
      AppValidationException,
    );
    expect(createService.create).not.toHaveBeenCalled();
  });

  it('recusa payload que quebra o contrato', async () => {
    await expect(
      controller.create(file, JSON.stringify({ topic: 10 })),
    ).rejects.toBeInstanceOf(AppValidationException);
  });

  it('atualiza usando o id da rota', async () => {
    updateService.update.mockResolvedValue({ id: ID });

    await controller.update(ID, payload({ id: 'outro' }), file);

    const [id, dto] = updateService.update.mock.calls[0] as [
      string,
      UpdateMeditationDto,
    ];
    expect(id).toBe(ID);
    expect(dto).toBeInstanceOf(UpdateMeditationDto);
  });

  it('lista as meditações', async () => {
    getService.findAll.mockResolvedValue([{ id: ID }]);

    await expect(controller.findAll()).resolves.toEqual([{ id: ID }]);
  });

  it('devolve null quando não há meditação da semana', async () => {
    getService.getThisWeekMeditation.mockResolvedValue(null);

    await expect(controller.getThisWeek()).resolves.toBeNull();
  });

  it('remove a meditação', async () => {
    await controller.remove(ID);

    expect(deleteService.remove).toHaveBeenCalledWith(ID);
  });
});
