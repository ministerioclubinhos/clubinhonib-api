import { AccessContext, UserRole } from 'src/core/auth/auth.types';
import { GetChildrenService } from 'src/modules/children/services/get-children.service';
import {
  AppConflictException,
  AppForbiddenException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';

import { DecisionType } from '../enums/decision-type.enum';
import { AcceptedChristRepository } from '../repositories/accepted-christ.repository';
import { DeleteAcceptedChristService } from './delete-accepted-christ.service';

describe('DeleteAcceptedChristService', () => {
  const repository = {
    findByIdWithChild: jest.fn(),
    findDecisionsOfChild: jest.fn(),
    deleteById: jest.fn(),
  };
  const getChildrenService = { findEntityForContextOrFail: jest.fn() };
  const teacher: AccessContext = { role: UserRole.TEACHER, userId: 'user-1' };

  const service = new DeleteAcceptedChristService(
    repository as unknown as AcceptedChristRepository,
    getChildrenService as unknown as GetChildrenService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findByIdWithChild.mockResolvedValue({
      id: 'decision-1',
      decision: DecisionType.ACCEPTED,
      child: { id: 'child-1' },
    });
    repository.findDecisionsOfChild.mockResolvedValue([
      { id: 'decision-1', decision: DecisionType.ACCEPTED },
    ]);
    getChildrenService.findEntityForContextOrFail.mockResolvedValue({
      id: 'child-1',
    });
  });

  it('exclui a decisão de uma criança do próprio alcance', async () => {
    await service.remove(teacher, 'decision-1');

    expect(repository.deleteById).toHaveBeenCalledWith('decision-1');
  });

  it('decisão de criança fora do alcance não existe', async () => {
    getChildrenService.findEntityForContextOrFail.mockRejectedValue(
      new AppNotFoundException(ErrorCode.CHILD_NOT_FOUND, 'sem acesso'),
    );

    await expect(service.remove(teacher, 'decision-1')).rejects.toMatchObject({
      code: ErrorCode.DECISION_NOT_FOUND,
    });
    expect(repository.deleteById).not.toHaveBeenCalled();
  });

  it('decisão inexistente responde não encontrada', async () => {
    repository.findByIdWithChild.mockResolvedValue(null);

    await expect(service.remove(teacher, 'x')).rejects.toBeInstanceOf(
      AppNotFoundException,
    );
  });

  it('não exclui a aceitação enquanto houver reconciliação', async () => {
    repository.findDecisionsOfChild.mockResolvedValue([
      { id: 'decision-1', decision: DecisionType.ACCEPTED },
      { id: 'decision-2', decision: DecisionType.RECONCILED },
    ]);

    await expect(service.remove(teacher, 'decision-1')).rejects.toBeInstanceOf(
      AppConflictException,
    );
    expect(repository.deleteById).not.toHaveBeenCalled();
  });

  it('exclui a reconciliação sem mexer na aceitação', async () => {
    repository.findByIdWithChild.mockResolvedValue({
      id: 'decision-2',
      decision: DecisionType.RECONCILED,
      child: { id: 'child-1' },
    });

    await service.remove(teacher, 'decision-2');

    expect(repository.deleteById).toHaveBeenCalledWith('decision-2');
  });

  it('barra quem não registra decisões', async () => {
    await expect(
      service.remove({ userId: null }, 'decision-1'),
    ).rejects.toBeInstanceOf(AppForbiddenException);
    expect(repository.findByIdWithChild).not.toHaveBeenCalled();
  });
});
