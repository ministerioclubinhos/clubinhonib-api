import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { DocumentMediaDto } from './document-media.dto';

const build = (overrides: Record<string, unknown>) =>
  plainToInstance(DocumentMediaDto, {
    uploadType: UploadType.LINK,
    mediaType: MediaType.DOCUMENT,
    isLocalFile: false,
    ...overrides,
  });

describe('DocumentMediaDto', () => {
  it.each([
    'https://drive.google.com/file/d/abc/view',
    'http://exemplo.com/doc.pdf',
  ])('aceita link http(s): %s', async (url) => {
    expect(await validate(build({ url }))).toHaveLength(0);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,x',
    'ftp://x.com/a',
    'sem-protocolo.com',
    '',
  ])('recusa link inválido: "%s"', async (url) => {
    const errors = await validate(build({ url }));
    expect(errors.some((e) => e.property === 'url')).toBe(true);
  });

  it('não exige URL quando é upload de arquivo', async () => {
    const errors = await validate(
      build({ uploadType: UploadType.UPLOAD, isLocalFile: true }),
    );
    expect(errors).toHaveLength(0);
  });
});
