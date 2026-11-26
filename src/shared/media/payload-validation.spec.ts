import { AppValidationException } from 'src/shared/exceptions';
import {
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import { assertMediaLinksAt, assertOwnedUniqueIds } from './payload-validation';

const link = (url: string | undefined): MediaItemDto =>
  Object.assign(new MediaItemDto(), {
    title: 'Mídia',
    uploadType: UploadType.LINK,
    mediaType: MediaType.VIDEO,
    isLocalFile: false,
    url,
  });

const locate = (index: number) => ({
  field: `videos.${index}.url`,
  label: `Vídeo ${index + 1}`,
});

describe('assertMediaLinksAt', () => {
  it('aceita links http e https', () => {
    expect(() =>
      assertMediaLinksAt(
        [link('https://youtu.be/abc'), link('http://exemplo.com/a')],
        locate,
      ),
    ).not.toThrow();
  });

  it('aponta a posição e o campo do primeiro link inválido', () => {
    let error: AppValidationException | undefined;
    try {
      assertMediaLinksAt(
        [link('https://ok.com'), link('youtube.com/sem-esquema')],
        locate,
      );
    } catch (caught) {
      error = caught as AppValidationException;
    }
    expect(error).toBeInstanceOf(AppValidationException);
    expect(error?.message).toBe(
      'Vídeo 2 · Link: Informe um link HTTP ou HTTPS válido para a mídia.',
    );
    expect(error?.details).toEqual({
      fieldErrors: [{ field: 'videos.1.url', message: error?.message }],
    });
  });

  it.each(['javascript:alert(1)', 'ftp://x.com/a', '', undefined])(
    'recusa %p',
    (url) => {
      expect(() => assertMediaLinksAt([link(url)], locate)).toThrow(
        AppValidationException,
      );
    },
  );

  it('ignora uploads', () => {
    const upload = Object.assign(link(undefined), {
      uploadType: UploadType.UPLOAD,
    });
    expect(() => assertMediaLinksAt([upload], locate)).not.toThrow();
  });
});

describe('assertOwnedUniqueIds', () => {
  it('aceita ids próprios e itens novos sem id', () => {
    expect(() =>
      assertOwnedUniqueIds(
        [{ id: 'a' }, {}],
        [{ id: 'a' }, { id: 'b' }],
        'vídeo',
      ),
    ).not.toThrow();
  });

  it('recusa id de outra página e id repetido', () => {
    expect(() =>
      assertOwnedUniqueIds([{ id: 'x' }], [{ id: 'a' }], 'vídeo'),
    ).toThrow('Identificador de vídeo inválido ou repetido');
    expect(() =>
      assertOwnedUniqueIds([{ id: 'a' }, { id: 'a' }], [{ id: 'a' }], 'vídeo'),
    ).toThrow(AppValidationException);
  });

  it('com posição, aponta o item e o campo na recusa', () => {
    let error: AppValidationException | undefined;
    try {
      assertOwnedUniqueIds(
        [{ id: 'a' }, { id: 'fora' }],
        [{ id: 'a' }],
        'seção',
        (index) => ({
          field: `sections.${index}.id`,
          label: `Seção ${index + 1}`,
        }),
      );
    } catch (caught) {
      error = caught as AppValidationException;
    }
    expect(error?.message).toBe(
      'Seção 2: Identificador de seção inválido ou repetido. Recarregue a página e tente novamente.',
    );
    expect(error?.details).toEqual({
      fieldErrors: [{ field: 'sections.1.id', message: error?.message }],
    });
  });
});
