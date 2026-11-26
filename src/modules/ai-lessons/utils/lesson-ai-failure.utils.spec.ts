import { BadGatewayException } from '@nestjs/common';
import { LessonStageType } from '../enums/lesson.enums';
import { LessonFailureCode } from '../enums/lesson-failure-code.enum';
import { describeAiFailure } from './lesson-ai-failure.utils';

describe('describeAiFailure', () => {
  it('classifica o tempo esgotado do texto como AI_TIMEOUT, não como imagem inválida', () => {
    const failure = describeAiFailure(
      LessonStageType.LESSON,
      new BadGatewayException(
        'Falha ao gerar LESSON na OpenAI: {"error":{"code":"deadline_exceeded"}}',
      ),
      { provider: 'OpenAI' },
    );
    expect(failure.code).toBe(LessonFailureCode.AI_TIMEOUT);
    expect(failure.message).toContain('demorou além do limite');
  });

  it('mantém imagem inválida quando o gateway não traz motivo do provedor', () => {
    const failure = describeAiFailure(
      LessonStageType.LESSON_VISUALS,
      new BadGatewayException(
        'O provedor de IA retornou um arquivo que não é uma imagem PNG ou JPEG válida.',
      ),
    );
    expect(failure.code).toBe(LessonFailureCode.AI_IMAGE_INVALID);
  });
  it('classifica JSON malformado como conteúdo inválido, não como imagem', () => {
    const failure = describeAiFailure(
      LessonStageType.LESSON_VISUALS,
      new BadGatewayException(
        'OpenAI retornou conteúdo estruturado inválido (JSON malformado).',
      ),
      { provider: 'OpenAI' },
    );
    expect(failure.code).toBe(LessonFailureCode.AI_CONTENT_INVALID);
  });
});
