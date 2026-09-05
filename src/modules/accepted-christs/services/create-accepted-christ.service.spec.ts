import { Test } from '@nestjs/testing';

import { AccessContext, UserRole } from 'src/core/auth/auth.types';
import { ChildEntity } from 'src/modules/children/entities/child.entity';
import { GetChildrenService } from 'src/modules/children/services/get-children.service';
import {
  AppForbiddenException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';

import { DecisionType } from '../enums/decision-type.enum';
import { AcceptedChristRepository } from '../repositories/accepted-christ.repository';
import { CreateAcceptedChristService } from './create-accepted-christ.service';
import { NotifyAcceptedChristService } from './notify-accepted-christ.service';

describe('CreateAcceptedChristService', () => {
  const acceptedChristRepository = { createForChild: jest.fn() };
  /** O aviso ao clubinho sai sem `await`; aqui basta saber que foi disparado. */
  const notifyAcceptedChrist = { notifyInBackground: jest.fn() };

  const getChildrenService = { findEntityForContextOrFail: jest.fn() };

  const teacher: AccessContext = { role: UserRole.TEACHER, userId: 'user-1' };

  const dto = {
    childId: 'child-1',
    decision: DecisionType.ACCEPTED,
    notes: 'Conversou depois da aula.',
  };

  const buildService = async (): Promise<CreateAcceptedChristService> => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateAcceptedChristService,
        {
          provide: AcceptedChristRepository,
          useValue: acceptedChristRepository,
        },
        { provide: GetChildrenService, useValue: getChildrenService },
        {
          provide: NotifyAcceptedChristService,
          useValue: notifyAcceptedChrist,
        },
      ],
    }).compile();

    return moduleRef.get(CreateAcceptedChristService);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getChildrenService.findEntityForContextOrFail.mockResolvedValue({
      id: 'child-1',
    } as ChildEntity);
    acceptedChristRepository.createForChild.mockResolvedValue({
      id: 'decision-1',
      decision: DecisionType.ACCEPTED,
      notes: 'Conversou depois da aula.',
      createdAt: new Date('2026-03-10T12:00:00Z'),
      updatedAt: new Date('2026-03-10T12:00:00Z'),
    });
  });

  it('grava a decisão e devolve o contrato público', async () => {
    const service = await buildService();

    const result = await service.create(teacher, dto);

    expect(acceptedChristRepository.createForChild).toHaveBeenCalledWith({
      childId: 'child-1',
      decision: DecisionType.ACCEPTED,
      notes: 'Conversou depois da aula.',
    });
    expect(result).toMatchObject({ id: 'decision-1', childId: 'child-1' });
    expect(result).not.toHaveProperty('child');
  });

  /**
   * O recorte por clubinho é do módulo de crianças: pedir a criança por lá é o
   * que impede um professor de registrar decisão da turma de outro.
   */
  it('confere o acesso à criança antes de gravar', async () => {
    const service = await buildService();

    await service.create(teacher, dto);

    expect(getChildrenService.findEntityForContextOrFail).toHaveBeenCalledWith(
      'child-1',
      teacher,
    );
  });

  it('não grava nada quando a criança está fora do alcance', async () => {
    getChildrenService.findEntityForContextOrFail.mockRejectedValue(
      new AppNotFoundException(
        ErrorCode.CHILD_NOT_FOUND,
        'Criança não encontrada ou sem acesso',
      ),
    );
    const service = await buildService();

    await expect(service.create(teacher, dto)).rejects.toBeInstanceOf(
      AppNotFoundException,
    );
    expect(acceptedChristRepository.createForChild).not.toHaveBeenCalled();
  });

  it('barra quem chega sem papel, antes de tocar na criança', async () => {
    const service = await buildService();

    await expect(service.create({ userId: null }, dto)).rejects.toBeInstanceOf(
      AppForbiddenException,
    );

    expect(
      getChildrenService.findEntityForContextOrFail,
    ).not.toHaveBeenCalled();
    expect(acceptedChristRepository.createForChild).not.toHaveBeenCalled();
  });

  it('aceita decisão e observação ausentes', async () => {
    acceptedChristRepository.createForChild.mockResolvedValue({
      id: 'decision-2',
      decision: null,
      notes: null,
      createdAt: new Date('2026-03-10T12:00:00Z'),
      updatedAt: new Date('2026-03-10T12:00:00Z'),
    });
    const service = await buildService();

    const result = await service.create(teacher, { childId: 'child-1' });

    expect(acceptedChristRepository.createForChild).toHaveBeenCalledWith({
      childId: 'child-1',
      decision: null,
      notes: null,
    });
    expect(result.decision).toBeNull();
  });
});
