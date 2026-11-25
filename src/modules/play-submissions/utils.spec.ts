import { UploadType } from 'src/shared/media/media-item/media-item.entity';
import { CreatePlaySubmissionDto } from './dto/play-submission.dto';
import { assertSubmissionPayload } from './utils';

const dto = (overrides: Partial<CreatePlaySubmissionDto>) =>
  Object.assign(new CreatePlaySubmissionDto(), {
    title: 'T',
    uploadType: UploadType.LINK,
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    ...overrides,
  });
const file = (mimetype: string, size = 100) =>
  ({ mimetype, size }) as Express.Multer.File;

describe('assertSubmissionPayload', () => {
  it('aceita link do YouTube e upload de vídeo', () => {
    expect(() =>
      assertSubmissionPayload(dto({}), undefined, undefined),
    ).not.toThrow();
    expect(() =>
      assertSubmissionPayload(
        dto({ uploadType: UploadType.UPLOAD, url: undefined }),
        file('video/mp4'),
        file('image/jpeg'),
      ),
    ).not.toThrow();
  });

  it.each([
    [
      'link que não é do YouTube',
      dto({ url: 'https://vimeo.com/123' }),
      undefined,
    ],
    ['link ausente', dto({ url: undefined }), undefined],
    ['link com arquivo anexado', dto({}), file('video/mp4')],
    ['upload sem arquivo', dto({ uploadType: UploadType.UPLOAD }), undefined],
    [
      'upload que não é vídeo',
      dto({ uploadType: UploadType.UPLOAD }),
      file('image/png'),
    ],
    [
      'upload acima de 100 MB',
      dto({ uploadType: UploadType.UPLOAD }),
      file('video/mp4', 101 * 1024 * 1024),
    ],
  ])('recusa %s', (_name, payload, video) => {
    expect(() => assertSubmissionPayload(payload, video, undefined)).toThrow();
  });

  it('recusa miniatura que não é imagem ou é grande demais', () => {
    expect(() =>
      assertSubmissionPayload(dto({}), undefined, file('video/mp4')),
    ).toThrow();
    expect(() =>
      assertSubmissionPayload(
        dto({}),
        undefined,
        file('image/png', 3 * 1024 * 1024),
      ),
    ).toThrow();
  });
});
