import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { AppValidationException, ErrorCode } from 'src/shared/exceptions';
import { UploadType } from 'src/shared/media/media-item/media-item.entity';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';

/** Onde uma mídia está no payload, para apontar o erro na tela. */
export interface MediaLocation {
  /** Caminho do campo, ex.: `sections.1.mediaItems.0.url`. */
  field: string;
  /** Posição legível, ex.: `Seção 2 · Imagem 1`. */
  label: string;
}

/**
 * Rejeita ids vencidos, de outra página ou repetidos, em vez de criar cópias em
 * silêncio. Com `locate`, a recusa aponta a posição do item em `fieldErrors`.
 */
export function assertOwnedUniqueIds(
  incoming: { id?: string }[],
  existing: { id: string }[],
  label: string,
  locate?: (index: number) => MediaLocation,
): void {
  const owned = new Set(existing.map((item) => item.id));
  const seen = new Set<string>();
  incoming.forEach((item, index) => {
    if (!item.id) return;
    if (!owned.has(item.id) || seen.has(item.id)) {
      const text = `Identificador de ${label} inválido ou repetido. Recarregue a página e tente novamente.`;
      if (!locate)
        throw new AppValidationException(ErrorCode.INVALID_INPUT, text);
      const where = locate(index);
      const message = `${where.label}: ${text}`;
      throw new AppValidationException(ErrorCode.INVALID_INPUT, message, {
        fieldErrors: [{ field: where.field, message }],
      });
    }
    seen.add(item.id);
  });
}

const LINK_MESSAGE = 'Informe um link HTTP ou HTTPS válido para a mídia.';

const isHttpUrl = (value: string | undefined): boolean => {
  try {
    return ['https:', 'http:'].includes(new URL(value?.trim() ?? '').protocol);
  } catch {
    return false;
  }
};

/** Mídia por link exige uma URL HTTP(S) absoluta. */
export function assertMediaLinks(items: MediaItemDto[]): void {
  for (const item of items) {
    if (item.uploadType !== UploadType.LINK) continue;
    if (!isHttpUrl(item.url)) {
      throw new AppValidationException(ErrorCode.INVALID_INPUT, LINK_MESSAGE);
    }
  }
}

/**
 * Igual a `assertMediaLinks`, mas a recusa diz qual mídia está errada e leva o
 * caminho do campo em `details.fieldErrors`, como a validação do DTO.
 */
export function assertMediaLinksAt(
  items: MediaItemDto[],
  locate: (index: number) => MediaLocation,
): void {
  items.forEach((item, index) => {
    if (item.uploadType !== UploadType.LINK || isHttpUrl(item.url)) return;
    const { field, label } = locate(index);
    const message = `${label} · Link: ${LINK_MESSAGE}`;
    throw new AppValidationException(ErrorCode.INVALID_INPUT, message, {
      fieldErrors: [{ field, message }],
    });
  });
}

/** Erro de validação de um campo, com a posição na mensagem. */
export interface PayloadFieldError {
  field: string;
  message: string;
}

/** Como nomear a página, o grupo (seção) e o item (imagem/vídeo) nas mensagens. */
export interface PayloadLabels {
  /** Ex.: `Galeria`. */
  page: string;
  /** Coleção intermediária, quando existe (ex.: `sections` → `Seção`). */
  group?: { property: string; label: string };
  /** Coleção de mídias (ex.: `mediaItems` → `Imagem`, `videos` → `Vídeo`). */
  item: { property: string; label: string };
  /** Nome de cada campo em português. */
  fields: Readonly<Record<string, string>>;
}

/** Dá a cada erro a posição do grupo/item, sem repetir o conteúdo enviado. */
export function toFieldErrors(
  errors: ValidationError[],
  labels: PayloadLabels,
  parent = '',
): PayloadFieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const children = toFieldErrors(error.children ?? [], labels, field);
    if (!error.constraints) return children;
    if (error.constraints.whitelistValidation) {
      return [
        {
          field: parent || 'page',
          message: 'Remova os campos não permitidos e tente novamente.',
        },
        ...children,
      ];
    }
    const group = labels.group
      ? new RegExp(`^${labels.group.property}\\.(\\d+)`).exec(field)
      : null;
    const item = new RegExp(`(?:^|\\.)${labels.item.property}\\.(\\d+)`).exec(
      field,
    );
    const label = [
      group && labels.group
        ? `${labels.group.label} ${Number(group[1]) + 1}`
        : labels.page,
      item ? `${labels.item.label} ${Number(item[1]) + 1}` : '',
      labels.fields[error.property] ?? '',
    ]
      .filter(Boolean)
      .join(' · ');
    return [
      {
        field,
        message: `${label}: ${Object.values(error.constraints).join(' ')}`,
      },
      ...children,
    ];
  });
}

/**
 * Lê e valida o JSON enviado junto dos arquivos, com as mesmas regras do
 * ValidationPipe global e erros por campo em português.
 */
export async function parseAndValidatePayload<T extends object>(
  raw: string | undefined,
  dtoClass: new () => T,
  payloadField: string,
  labels: PayloadLabels,
): Promise<T> {
  if (!raw) {
    throw new AppValidationException(
      ErrorCode.INVALID_INPUT,
      `${payloadField} é obrigatório`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppValidationException(
      ErrorCode.INVALID_INPUT,
      `${payloadField} deve conter um JSON válido`,
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AppValidationException(
      ErrorCode.INVALID_INPUT,
      'Os dados da página devem ser um objeto JSON',
    );
  }

  const dto = plainToInstance(dtoClass, parsed);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
    validationError: { target: false, value: false },
  });

  if (errors.length > 0) {
    const fieldErrors = toFieldErrors(errors, labels);
    throw new AppValidationException(
      ErrorCode.VALIDATION_ERROR,
      fieldErrors[0]?.message ?? 'Revise os dados da página e tente novamente.',
      { fieldErrors },
    );
  }

  return dto;
}
