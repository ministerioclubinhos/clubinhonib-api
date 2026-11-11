import { isAxiosError } from 'axios';
import {
  AI_MODEL_CATALOG,
  AI_MODEL_CATALOG_WARNING,
} from '../constants/ai-provider-settings.constants';
import {
  AiModelCatalogLists,
  GeminiModelListResponse,
  OpenAiModelListResponse,
} from '../dto/ai-provider-settings-response.dto';

const unique = (values: string[]): string[] => Array.from(new Set(values));

/** Newest first; only families the Studio can drive. */
export function openAiCatalogModels(
  response: OpenAiModelListResponse | undefined,
): AiModelCatalogLists {
  const list = Array.isArray(response?.data) ? response.data : [];
  const ids = [...list]
    .filter((model) => typeof model?.id === 'string')
    .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
    .map((model) => model.id);
  const isImage = (id: string): boolean =>
    AI_MODEL_CATALOG.imagePrefixes.some((prefix) => id.startsWith(prefix));
  return {
    image: unique(ids.filter(isImage)),
    general: unique(
      ids.filter(
        (id) =>
          !isImage(id) &&
          AI_MODEL_CATALOG.generalPrefixes.some((prefix) =>
            id.startsWith(prefix),
          ) &&
          !AI_MODEL_CATALOG.excludedFragments.some((fragment) =>
            id.includes(fragment),
          ),
      ),
    ),
  };
}

/** Gemini text models that answer generateContent, and Gemini image models. */
export function geminiCatalogModels(
  response: GeminiModelListResponse | undefined,
): AiModelCatalogLists {
  const list = Array.isArray(response?.models) ? response.models : [];
  const general: string[] = [];
  const image: string[] = [];
  for (const model of list) {
    if (typeof model?.name !== 'string') continue;
    const id = model.name.startsWith(AI_MODEL_CATALOG.geminiNamePrefix)
      ? model.name.slice(AI_MODEL_CATALOG.geminiNamePrefix.length)
      : model.name;
    if (
      !id.startsWith(AI_MODEL_CATALOG.geminiPrefix) ||
      AI_MODEL_CATALOG.geminiExcludedFragments.some((fragment) =>
        id.includes(fragment),
      )
    )
      continue;
    if (id.includes(AI_MODEL_CATALOG.geminiImageFragment)) image.push(id);
    else if (
      Array.isArray(model.supportedGenerationMethods) &&
      model.supportedGenerationMethods.includes(
        AI_MODEL_CATALOG.geminiTextMethod,
      )
    )
      general.push(id);
  }
  // The provider lists oldest first; show the newest families on top.
  return {
    general: unique(general).sort().reverse(),
    image: unique(image).sort().reverse(),
  };
}

/** Explains a failed live lookup without exposing the provider answer. */
export function modelCatalogFailureWarning(
  provider: string,
  error: unknown,
  rejectedKeyStatuses: readonly number[],
): string {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  if (status !== undefined && rejectedKeyStatuses.includes(status))
    return AI_MODEL_CATALOG_WARNING.rejectedKey(provider);
  if (status === AI_MODEL_CATALOG.forbiddenStatus)
    return AI_MODEL_CATALOG_WARNING.forbidden(provider);
  return AI_MODEL_CATALOG_WARNING.unavailable(provider);
}
