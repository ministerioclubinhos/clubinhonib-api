import {
  extractOwnedLessonVersionAssetUrls,
  isLessonOwnedS3Key,
} from './lesson-asset-ownership.utils';

const LESSON_ID = '6f1d2c3b-4a5e-4f60-8a1b-2c3d4e5f6a7b';
const OTHER_ID = '11111111-2222-4333-8444-555555555555';
const BUCKET = 'studio-bucket';
// Exactly what AwsS3Service.upload produces: <env>/uploads/<ts>_<uuid8>_<originalname>.
const realKey = (lessonId: string, name: string): string =>
  `prod/uploads/1762700000000_ab12cd34_${lessonId}-${name}`;
const url = (key: string): string =>
  `https://${BUCKET}.s3.us-east-2.amazonaws.com/${key}`;

describe('lesson asset ownership (BE02 — real S3 key format)', () => {
  it('reconhece a chave real gerada pelo upload e a forma legada sem prefixo', () => {
    expect(
      isLessonOwnedS3Key(
        LESSON_ID,
        realKey(LESSON_ID, 'LESSON_VISUALS-kit-01.png'),
      ),
    ).toBe(true);
    expect(
      isLessonOwnedS3Key(LESSON_ID, `${LESSON_ID}-LESSON_VISUALS-kit-01.png`),
    ).toBe(true);
    expect(
      isLessonOwnedS3Key(
        LESSON_ID,
        realKey(OTHER_ID, 'LESSON_VISUALS-kit-01.png'),
      ),
    ).toBe(false);
    // The lesson id must open the original name, not merely appear in it.
    expect(
      isLessonOwnedS3Key(
        LESSON_ID,
        `prod/uploads/1762700000000_ab12cd34_x-${LESSON_ID}-a.png`,
      ),
    ).toBe(false);
    expect(isLessonOwnedS3Key('', realKey('', 'a.png'))).toBe(false);
  });

  it('extrai somente os assets da própria lição, inclusive DOCX/PDF', () => {
    const owned = url(realKey(LESSON_ID, 'LESSON_VISUALS-kit-01.png'));
    const ownedPdf = url(realKey(LESSON_ID, 'LESSON-export.pdf'));
    const foreign = url(realKey(OTHER_ID, 'LESSON_VISUALS-kit-01.png'));
    const shared = url('prod/uploads/1762700000000_ab12cd34_banner.png');
    expect(
      extractOwnedLessonVersionAssetUrls(
        LESSON_ID,
        {
          docxS3Key: shared,
          pdfS3Key: ownedPdf,
          structuredDataJson: {
            assets: [{ url: owned }, { url: foreign }],
            printableAssets: [{ url: shared }],
            _ownedAssetUrls: [owned, foreign, shared],
            story: `texto com ${shared}`,
          },
        },
        BUCKET,
      ).sort(),
    ).toEqual([owned, ownedPdf].sort());
  });

  it('ignora URLs de hosts parecidos com o bucket', () => {
    expect(
      extractOwnedLessonVersionAssetUrls(
        LESSON_ID,
        {
          structuredDataJson: {
            assets: [
              {
                url: `https://${BUCKET}.s3evil.amazonaws.com/${realKey(LESSON_ID, 'a.png')}`,
              },
            ],
          },
        },
        BUCKET,
      ),
    ).toEqual([]);
  });
});
