import { AppValidationException } from 'src/shared/exceptions';
import { UploadType } from 'src/shared/media/media-item/media-item.entity';

import { CreateIdeasSectionDto } from './dto/create-ideas-section.dto';
import { IdeasSectionMediaType } from './entities/ideas-section-media-type.enum';
import {
  applyAdminMediaMetadata,
  applyGeneratedMediaMetadata,
  buildIdeasMediaTitle,
  isGeneratedMediaTitle,
} from './utils';
import {
  assertUploadsHaveFiles,
  parseSectionPayload,
  toFilesDict,
} from './utils';

const arquivo = (fieldname: string): Express.Multer.File =>
  ({ fieldname, originalname: `${fieldname}.jpg` }) as Express.Multer.File;

const midiaDeUpload = {
  title: 'Foto',
  uploadType: UploadType.UPLOAD,
  mediaType: IdeasSectionMediaType.IMAGE,
  isLocalFile: true,
  originalName: 'foto.jpg',
  fieldKey: 'file_0',
};

describe('ideas-section utils', () => {
  it('generates media titles with per-type positions and empty descriptions', () => {
    const generated = applyGeneratedMediaMetadata(
      [
        {
          mediaType: IdeasSectionMediaType.DOCUMENT,
          title: 'client value',
          description: 'client value',
        },
        { mediaType: IdeasSectionMediaType.IMAGE },
        { mediaType: IdeasSectionMediaType.DOCUMENT },
      ],
      '  Ideia  ',
    );
    expect(
      generated.map(({ title, description }) => [title, description]),
    ).toEqual([
      ['Documento 1 — Ideia', ''],
      ['Imagem 1 — Ideia', ''],
      ['Documento 2 — Ideia', ''],
    ]);
  });

  it('trims and truncates generated titles and recognizes their suffix', () => {
    const title = buildIdeasMediaTitle(
      'x'.repeat(300),
      IdeasSectionMediaType.VIDEO,
      1,
    );
    expect(title).toHaveLength(255);
    expect(
      isGeneratedMediaTitle('Documento 1 — Minha ideia', 'Minha ideia'),
    ).toBe(true);
  });

  it('regenerates only server-generated titles when an admin changes the idea title', () => {
    const medias = applyAdminMediaMetadata(
      [
        {
          id: 'm1',
          mediaType: IdeasSectionMediaType.IMAGE,
          title: 'Imagem 1 — Título antigo',
          description: '',
        },
        {
          id: 'm2',
          mediaType: IdeasSectionMediaType.IMAGE,
          title: 'Legenda manual',
          description: 'descrição',
        },
        { mediaType: IdeasSectionMediaType.DOCUMENT },
      ],
      'Título novo',
      'Título antigo',
    );
    expect(medias.map((media) => media.title)).toEqual([
      'Imagem 1 — Título novo',
      'Legenda manual',
      'Documento 1 — Título novo',
    ]);
  });

  describe('parseSectionPayload', () => {
    const valido = JSON.stringify({
      title: 'Brincadeira dos balões',
      description: 'Ideia para o clubinho',
      medias: [],
    });

    it('aceita o JSON que vem junto dos arquivos', async () => {
      const dto = await parseSectionPayload(CreateIdeasSectionDto, valido);

      expect(dto.title).toBe('Brincadeira dos balões');
    });

    it('aceita o mesmo conteúdo como Buffer', async () => {
      const dto = await parseSectionPayload(
        CreateIdeasSectionDto,
        Buffer.from(valido),
      );

      expect(dto.title).toBe('Brincadeira dos balões');
    });

    it('recusa corpo ausente', async () => {
      await expect(
        parseSectionPayload(CreateIdeasSectionDto, undefined),
      ).rejects.toBeInstanceOf(AppValidationException);
    });

    it('recusa JSON malformado', async () => {
      // O corpo é multipart, então o pipe global não chega aqui: quem valida
      // é esta função, e uma falha dela não pode virar erro interno.
      await expect(
        parseSectionPayload(CreateIdeasSectionDto, '{ isto não é json'),
      ).rejects.toBeInstanceOf(AppValidationException);
    });

    it('recusa campo fora do contrato', async () => {
      await expect(
        parseSectionPayload(
          CreateIdeasSectionDto,
          JSON.stringify({ ...JSON.parse(valido), inventado: true }),
        ),
      ).rejects.toBeInstanceOf(AppValidationException);
    });
  });

  describe('assertUploadsHaveFiles', () => {
    it('deixa passar quando o arquivo veio', () => {
      expect(() =>
        assertUploadsHaveFiles(
          [midiaDeUpload as never],
          toFilesDict([arquivo('file_0')]),
        ),
      ).not.toThrow();
    });

    it('barra upload sem o arquivo correspondente', () => {
      // Antes a checagem existia e nunca era chamada: a mídia era gravada
      // apontando para lugar nenhum.
      expect(() =>
        assertUploadsHaveFiles([midiaDeUpload as never], {}),
      ).toThrow(AppValidationException);
    });

    it('barra upload sem o nome do arquivo', () => {
      expect(() =>
        assertUploadsHaveFiles(
          [{ ...midiaDeUpload, originalName: undefined } as never],
          toFilesDict([arquivo('file_0')]),
        ),
      ).toThrow(AppValidationException);
    });

    it('ignora mídia de link, que não tem arquivo', () => {
      expect(() =>
        assertUploadsHaveFiles(
          [
            {
              title: 'Vídeo',
              uploadType: UploadType.LINK,
              mediaType: IdeasSectionMediaType.VIDEO,
              isLocalFile: false,
              url: 'https://youtube.com/x',
            } as never,
          ],
          {},
        ),
      ).not.toThrow();
    });
  });

  it('indexa os arquivos pelo nome do campo', () => {
    expect(Object.keys(toFilesDict([arquivo('a'), arquivo('b')]))).toEqual([
      'a',
      'b',
    ]);
    expect(toFilesDict()).toEqual({});
  });
});
