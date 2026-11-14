import { ImageSectionCelebrationsRepository } from '../repositories/image-section-celebrations.repository';
import { UpdateImageSectionCelebrationService } from './update-image-section-celebration.service';

describe('UpdateImageSectionCelebrationService', () => {
  const repository = {
    findSectionAuthorId: jest.fn(),
    toggle: jest.fn(),
    findBySections: jest.fn(),
  };
  const service = new UpdateImageSectionCelebrationService(
    repository as unknown as ImageSectionCelebrationsRepository,
  );
  beforeEach(() => jest.resetAllMocks());

  it('sem usuário não grava nada', async () => {
    await expect(service.toggle('s1', null)).resolves.toEqual({
      celebrated: false,
      celebrationCount: 0,
      celebrators: [],
    });
    expect(repository.toggle).not.toHaveBeenCalled();
  });

  it('seção inexistente não grava nada', async () => {
    repository.findSectionAuthorId.mockResolvedValue(undefined);
    await expect(service.toggle('s1', 'u1')).resolves.toMatchObject({
      celebrated: false,
      celebrationCount: 0,
    });
    expect(repository.toggle).not.toHaveBeenCalled();
  });

  it('o autor não celebra a própria publicação', async () => {
    repository.findSectionAuthorId.mockResolvedValue('u1');
    await expect(service.toggle('s1', 'u1')).resolves.toMatchObject({
      ownPublication: true,
    });
    expect(repository.toggle).not.toHaveBeenCalled();
  });

  it('alterna e devolve a contagem atualizada', async () => {
    repository.findSectionAuthorId.mockResolvedValue(null);
    repository.toggle.mockResolvedValue(true);
    repository.findBySections.mockResolvedValue([
      { sectionId: 's1', userId: 'u2', userName: 'Ana' },
      { sectionId: 's1', userId: 'u1', userName: 'Bia' },
    ]);
    await expect(service.toggle('s1', 'u1')).resolves.toEqual({
      celebrated: true,
      celebrationCount: 2,
      celebrators: ['Ana', 'Bia'],
    });
    expect(repository.toggle).toHaveBeenCalledWith('s1', 'u1');
  });

  it('desfazer a última celebração zera a contagem', async () => {
    repository.findSectionAuthorId.mockResolvedValue('autor');
    repository.toggle.mockResolvedValue(false);
    repository.findBySections.mockResolvedValue([]);
    await expect(service.toggle('s1', 'u1')).resolves.toEqual({
      celebrated: false,
      celebrationCount: 0,
      celebrators: [],
    });
  });
});
