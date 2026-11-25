import { AuditOutcome } from '../enums';
import { isAuditNoise } from './audit-noise.utils';

describe('isAuditNoise', () => {
  const event = (
    overrides: Partial<Parameters<typeof isAuditNoise>[0]>,
  ): Parameters<typeof isAuditNoise>[0] => ({
    outcome: AuditOutcome.Succeeded,
    jobName: null,
    controllerName: null,
    handlerName: null,
    ...overrides,
  });

  it('silencia o batimento do agendador e a renovação de token bem-sucedidos', () => {
    expect(isAuditNoise(event({ jobName: 'scheduler-heartbeat' }))).toBe(true);
    expect(
      isAuditNoise(
        event({ controllerName: 'AuthController', handlerName: 'refresh' }),
      ),
    ).toBe(true);
    expect(
      isAuditNoise(
        event({
          controllerName: 'FeedPhotoCommentsController',
          handlerName: 'readNotification',
        }),
      ),
    ).toBe(true);
  });

  it('nunca silencia falha, negação ou rejeição das mesmas ações', () => {
    for (const outcome of [
      AuditOutcome.Failed,
      AuditOutcome.Denied,
      AuditOutcome.Rejected,
      AuditOutcome.NotFound,
    ]) {
      expect(
        isAuditNoise(event({ outcome, jobName: 'scheduler-heartbeat' })),
      ).toBe(false);
      expect(
        isAuditNoise(
          event({
            outcome,
            controllerName: 'AuthController',
            handlerName: 'refresh',
          }),
        ),
      ).toBe(false);
    }
  });

  it('mantém as ações de negócio e os demais jobs', () => {
    expect(
      isAuditNoise(
        event({ controllerName: 'AuthController', handlerName: 'login' }),
      ),
    ).toBe(false);
    expect(
      isAuditNoise(
        event({ controllerName: 'ClubsController', handlerName: 'refresh' }),
      ),
    ).toBe(false);
    expect(isAuditNoise(event({ jobName: 'missing-pagela-reminder' }))).toBe(
      false,
    );
  });
});
