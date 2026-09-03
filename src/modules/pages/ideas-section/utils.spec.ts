import { AppValidationException } from 'src/shared/exceptions';
import { UploadType } from 'src/shared/media/media-item/media-item.entity';

import { CreateIdeasSectionDto } from './dto/create-ideas-section.dto';
import { IdeasSectionMediaType } from './entities/ideas-section-media-type.enum';
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
