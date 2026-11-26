import { ConfigService } from '@nestjs/config';
import { AwsS3Service } from './aws-s3.service';

const buildService = (bucket = 'clubinho-nib'): AwsS3Service => {
  const config = {
    get: (key: string) =>
      ({
        AWS_REGION: 'us-east-1',
        ENVIRONMENT: 'production',
        AWS_S3_BUCKET_NAME: bucket,
      })[key],
  } as unknown as ConfigService;

  return new AwsS3Service(config);
};

describe('AwsS3Service.extractKey', () => {
  const service = buildService();

  it('lê a chave da URL gerada pelo próprio upload', () => {
    expect(
      service.extractKey(
        'https://clubinho-nib.s3.amazonaws.com/production/uploads/1_a.png',
      ),
    ).toBe('production/uploads/1_a.png');
  });

  it('lê a chave da URL com região no host', () => {
    // Arquivos antigos e links montados à mão usam a forma regional; ignorá-la
    // deixaria o objeto no bucket para sempre.
    expect(
      service.extractKey(
        'https://clubinho-nib.s3.us-east-1.amazonaws.com/production/cards/card.png',
      ),
    ).toBe('production/cards/card.png');
  });

  it('lê a chave da URL no formato path-style', () => {
    expect(
      service.extractKey(
        'https://s3.us-east-1.amazonaws.com/clubinho-nib/production/uploads/a.png',
      ),
    ).toBe('production/uploads/a.png');
  });

  it('decodifica caracteres escapados no caminho', () => {
    expect(
      service.extractKey(
        'https://clubinho-nib.s3.amazonaws.com/production/uploads/a%20b.png',
      ),
    ).toBe('production/uploads/a b.png');
  });

  it('recusa URL de outro bucket', () => {
    expect(
      service.extractKey('https://outro-bucket.s3.amazonaws.com/uploads/a.png'),
    ).toBeNull();
    expect(
      service.extractKey(
        'https://s3.us-east-1.amazonaws.com/outro-bucket/uploads/a.png',
      ),
    ).toBeNull();
  });

  it('recusa URL fora do S3 e texto que não é URL', () => {
    expect(service.extractKey('https://youtube.com/watch?v=abc')).toBeNull();
    expect(service.extractKey('não é uma url')).toBeNull();
    expect(
      service.extractKey('https://clubinho-nib.s3.amazonaws.com/'),
    ).toBeNull();
  });
});
