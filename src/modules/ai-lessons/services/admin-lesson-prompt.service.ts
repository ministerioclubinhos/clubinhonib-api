import { getLessonTemplate } from '../templates/special-lesson-templates';
import { ConflictException, Injectable } from '@nestjs/common';
import {
  LESSON_SHARED_QUALITY_RULES,
  LESSON_STAGE_QUALITY_RULES,
} from '../constants/lesson-quality.constants';
import {
  ADMIN_PROMPT_CONFLICT,
  LESSON_STAGE_BASE_PROMPTS,
} from '../constants/lesson-base-prompts.constants';
import { AdminLessonPromptView } from '../types/admin-lesson-prompt.types';

export { AdminLessonPromptView };
import { AdminLessonPromptEntity } from '../entities/admin-lesson-prompt.entity';
import {
  getLessonStageOrder,
  LessonCategory,
  LessonStageType,
} from '../enums/lesson.enums';
import { AdminLessonPromptRepository } from '../repositories/admin-lesson-prompt.repository';

@Injectable()
export class AdminLessonPromptService {
  private readonly inFlightKeys = new Set<string>();

  constructor(private readonly promptsRepo: AdminLessonPromptRepository) {}

  async list(
    adminId: string,
    category: LessonCategory = LessonCategory.REGULAR,
  ): Promise<AdminLessonPromptView[]> {
    const saved = await this.promptsRepo.findByAdminId(adminId, category);
    return getLessonStageOrder(category).map((stage) =>
      this.view(
        stage,
        saved.find((item) => item.stage === stage) ?? null,
        category,
      ),
    );
  }

  async effective(
    adminId: string,
    stage: LessonStageType,
    category: LessonCategory = LessonCategory.REGULAR,
  ): Promise<string> {
    const saved = await this.promptsRepo.findByAdminIdAndStage(
      adminId,
      stage,
      category,
    );
    const activeCustom = saved?.customPrompt?.trim()
      ? saved.customPrompt
      : null;
    return this.composeEffectivePrompt(stage, activeCustom, category);
  }

  async save(
    adminId: string,
    stage: LessonStageType,
    prompt: string,
    lockVersion?: number,
    category: LessonCategory = LessonCategory.REGULAR,
  ): Promise<AdminLessonPromptView> {
    const key = `${adminId}:${category}:${stage}`;
    if (this.inFlightKeys.has(key)) {
      throw new ConflictException(ADMIN_PROMPT_CONFLICT.save);
    }
    this.inFlightKeys.add(key);
    try {
      const normalized = prompt.trim();
      const current = await this.promptsRepo.findByAdminIdAndStage(
        adminId,
        stage,
        category,
      );
      if (current) {
        // Every existing row is versioned, including one already reset: a
        // save without the version the editor loaded is a blind overwrite.
        const currentLockVersion = current.lockVersion ?? 1;
        if (lockVersion !== currentLockVersion)
          throw new ConflictException(ADMIN_PROMPT_CONFLICT.save);
        const updated = await this.promptsRepo.updatePromptWhereVersion(
          current.id,
          currentLockVersion,
          normalized,
        );
        if (!updated) throw new ConflictException(ADMIN_PROMPT_CONFLICT.save);
        return this.view(
          stage,
          (await this.promptsRepo.findByAdminIdAndStage(
            adminId,
            stage,
            category,
          )) ??
            Object.assign(current, {
              customPrompt: normalized,
              lockVersion: currentLockVersion + 1,
            }),
          category,
        );
      }

      if (lockVersion !== undefined) {
        throw new ConflictException(ADMIN_PROMPT_CONFLICT.save);
      }

      try {
        const created = this.promptsRepo.createPrompt({
          adminId,
          category,
          stage,
          customPrompt: normalized,
        });
        const saved = await this.promptsRepo.savePrompt(created);
        return this.view(stage, saved, category);
      } catch (error: unknown) {
        const code =
          error && typeof error === 'object' && 'code' in error
            ? String((error as { code?: unknown }).code)
            : '';
        const message = error instanceof Error ? error.message : String(error);
        if (code === 'ER_DUP_ENTRY' || /duplicate/i.test(message)) {
          throw new ConflictException(ADMIN_PROMPT_CONFLICT.save);
        }
        throw error;
      }
    } finally {
      this.inFlightKeys.delete(key);
    }
  }

  async reset(
    adminId: string,
    stage: LessonStageType,
    lockVersion?: number,
    category: LessonCategory = LessonCategory.REGULAR,
  ): Promise<AdminLessonPromptView> {
    const key = `${adminId}:${category}:${stage}`;
    if (this.inFlightKeys.has(key)) {
      throw new ConflictException(ADMIN_PROMPT_CONFLICT.reset);
    }
    this.inFlightKeys.add(key);
    try {
      const current = await this.promptsRepo.findByAdminIdAndStage(
        adminId,
        stage,
        category,
      );
      if (!current) {
        return this.view(stage, null, category);
      }
      const currentLockVersion = current.lockVersion ?? 1;
      if (lockVersion !== currentLockVersion)
        throw new ConflictException(ADMIN_PROMPT_CONFLICT.reset);
      // The row is kept with an empty complement so its version stays monotonic.
      const updated = await this.promptsRepo.updatePromptWhereVersion(
        current.id,
        currentLockVersion,
        '',
      );
      if (!updated) throw new ConflictException(ADMIN_PROMPT_CONFLICT.reset);
      return this.view(
        stage,
        (await this.promptsRepo.findByAdminIdAndStage(
          adminId,
          stage,
          category,
        )) ??
          Object.assign(current, {
            customPrompt: '',
            lockVersion: currentLockVersion + 1,
          }),
        category,
      );
    } finally {
      this.inFlightKeys.delete(key);
    }
  }

  private view(
    stage: LessonStageType,
    entity: AdminLessonPromptEntity | null,
    category: LessonCategory = LessonCategory.REGULAR,
  ): AdminLessonPromptView {
    const customPrompt = entity?.customPrompt?.trim()
      ? entity.customPrompt
      : null;
    return {
      stage,
      basePrompt: this.basePrompt(stage, category),
      customPrompt,
      effectivePrompt: this.composeEffectivePrompt(
        stage,
        customPrompt,
        category,
      ),
      lockVersion: entity?.lockVersion ?? null,
    };
  }

  private basePrompt(
    stage: LessonStageType,
    category: LessonCategory = LessonCategory.REGULAR,
  ): string {
    if (category === LessonCategory.SPECIAL)
      return getLessonTemplate(stage, category).rules.join('\n\n');
    return `${LESSON_STAGE_BASE_PROMPTS[stage]}\n\nCRITÉRIOS GERAIS DE QUALIDADE PARA TODAS AS ETAPAS\n${LESSON_SHARED_QUALITY_RULES.join('\n')}\n\nREVISÃO ESPECÍFICA DA ETAPA\n${LESSON_STAGE_QUALITY_RULES[stage]}`;
  }

  private composeEffectivePrompt(
    stage: LessonStageType,
    customPrompt: string | null,
    category: LessonCategory = LessonCategory.REGULAR,
  ): string {
    const basePrompt = this.basePrompt(stage, category);
    if (!customPrompt) return basePrompt;
    return `${basePrompt}\n\nORIENTAÇÃO COMPLEMENTAR DO ADMINISTRADOR\n${customPrompt}\n\nA orientação complementar não substitui estrutura, fidelidade bíblica, segurança infantil, formato de impressão ou critérios editoriais obrigatórios acima.`;
  }
}
