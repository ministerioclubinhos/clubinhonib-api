import { PlayScope } from './enums/play-scope.enum';
import {
  assertPlayPayload,
  assertThumbnails,
  buildEntryInputs,
  slugify,
} from './utils';

describe('assertPlayPayload', () => {
  it('aceita payload sem `play` e sem atributos de Play', () => {
    expect(() => assertPlayPayload(undefined, [{}, {}])).not.toThrow();
  });

  it('recusa inPlay sem `play` apontando a posição do vídeo', () => {
    try {
      assertPlayPayload(undefined, [{}, { inPlay: true }]);
      fail('deveria lançar');
    } catch (error) {
      const details = (
        error as { details?: { fieldErrors: { field: string }[] } }
      ).details;
      expect(details?.fieldErrors[0].field).toBe('videos.1.inPlay');
    }
  });

  it('recusa atributos no escopo "none"', () => {
    expect(() =>
      assertPlayPayload({ scope: PlayScope.NONE }, [{ featured: true }]),
    ).toThrow();
  });

  it('recusa inPlay no escopo "all"', () => {
    expect(() =>
      assertPlayPayload({ scope: PlayScope.ALL }, [{ inPlay: true }]),
    ).toThrow();
  });

  it('aceita destaque e posição no escopo "all"', () => {
    expect(() =>
      assertPlayPayload({ scope: PlayScope.ALL }, [
        { featured: true, position: 2 },
      ]),
    ).not.toThrow();
  });

  it('recusa destaque de vídeo fora do Play no escopo "selected"', () => {
    expect(() =>
      assertPlayPayload({ scope: PlayScope.SELECTED }, [
        { inPlay: false, featured: true },
      ]),
    ).toThrow();
  });

  it('permite "selected" sem nenhum vídeo marcado (rascunho)', () => {
    expect(() =>
      assertPlayPayload({ scope: PlayScope.SELECTED }, [
        { inPlay: false },
        { inPlay: false },
      ]),
    ).not.toThrow();
  });
});

describe('buildEntryInputs', () => {
  const videos = [
    { inPlay: true, featured: true, position: 1 },
    { inPlay: false },
    { inPlay: true },
  ];

  it('"none" não gera linhas', () => {
    expect(buildEntryInputs(PlayScope.NONE, ['a', 'b', 'c'], videos)).toEqual(
      [],
    );
  });

  it('"selected" gera só os marcados, ligando pela posição', () => {
    expect(
      buildEntryInputs(PlayScope.SELECTED, ['a', 'b', 'c'], videos),
    ).toEqual([
      {
        mediaItemId: 'a',
        featured: true,
        position: 1,
        thumbnailUrl: null,
        durationSeconds: null,
      },
      {
        mediaItemId: 'c',
        featured: false,
        position: null,
        thumbnailUrl: null,
        durationSeconds: null,
      },
    ]);
  });

  it('"all" gera uma linha por vídeo', () => {
    expect(
      buildEntryInputs(PlayScope.ALL, ['a', 'b'], [{}, { featured: true }]),
    ).toEqual([
      {
        mediaItemId: 'a',
        featured: false,
        position: null,
        thumbnailUrl: null,
        durationSeconds: null,
      },
      {
        mediaItemId: 'b',
        featured: true,
        position: null,
        thumbnailUrl: null,
        durationSeconds: null,
      },
    ]);
  });
});

describe('buildEntryInputs — miniatura e duração', () => {
  it('usa a miniatura nova e preserva a antiga de quem não enviou outra', () => {
    const previous = new Map([
      ['a', { thumbnailUrl: 'https://s3/antiga.jpg', durationSeconds: 90 }],
      ['b', { thumbnailUrl: 'https://s3/b.jpg', durationSeconds: 10 }],
    ]);

    const entries = buildEntryInputs(
      PlayScope.ALL,
      ['a', 'b'],
      [{ durationSeconds: 120 }, {}],
      ['https://s3/nova.jpg', null],
      previous,
    );

    expect(entries[0]).toMatchObject({
      thumbnailUrl: 'https://s3/nova.jpg',
      durationSeconds: 120,
    });
    expect(entries[1]).toMatchObject({
      thumbnailUrl: 'https://s3/b.jpg',
      durationSeconds: 10,
    });
  });
});

describe('assertThumbnails', () => {
  const file = (mimetype: string, size: number) =>
    ({ mimetype, size }) as Express.Multer.File;

  it('aceita imagem pequena', () => {
    expect(() =>
      assertThumbnails([{ thumbnailField: 't0' }], {
        t0: file('image/jpeg', 100),
      }),
    ).not.toThrow();
  });

  it.each([
    ['ausente', {}],
    ['não imagem', { t0: file('video/mp4', 100) }],
    ['grande demais', { t0: file('image/png', 3 * 1024 * 1024) }],
  ])('recusa miniatura %s', (_name, files) => {
    expect(() => assertThumbnails([{ thumbnailField: 't0' }], files)).toThrow();
  });
});

describe('slugify', () => {
  it('remove acentos e normaliza', () => {
    expect(slugify('  Músicas & Dinâmicas! ')).toBe('musicas-dinamicas');
  });
});
