import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

@Injectable()
export class AwsS3Service {
  private readonly logger = new Logger(AwsS3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly environment: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION') || 'us-east-2';
    this.environment = this.configService.get<string>('ENVIRONMENT') ?? '';

    this.bucketName =
      this.configService.get<string>('AWS_S3_BUCKET_NAME') || '';
    if (!this.bucketName) {
      this.logger.error('AWS_S3_BUCKET_NAME not defined');
    }

    // Credenciais resolvidas automaticamente pelo SDK:
    // - Em produção (ECS): IAM Role da task via instance metadata
    // - Em desenvolvimento: variáveis de ambiente AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
    this.s3Client = new S3Client({
      region: this.region,
    });
  }

  async upload(file: Express.Multer.File): Promise<string> {
    const sanitizedFilename = file.originalname.replace(
      /[^a-zA-Z0-9.\-_]/g,
      '_',
    );

    // O sufixo aleatório evita que dois envios do mesmo arquivo no mesmo
    // milissegundo gerem a mesma chave: o segundo sobrescreveria o primeiro e
    // deixaria a mídia já gravada apontando para um objeto trocado.
    const key = `${this.environment}/uploads/${Date.now()}_${randomUUID().slice(0, 8)}_${sanitizedFilename}`;
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    try {
      await this.s3Client.send(command);
      return `https://${this.bucketName}.s3.amazonaws.com/${key}`;
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`Error uploading to S3: ${error.message}`);
      throw new Error('Error uploading to S3');
    }
  }

  /**
   * Chave do objeto dentro do bucket. Aceita as duas formas de URL do S3
   * — `bucket.s3[.regiao].amazonaws.com/chave` e
   * `s3.regiao.amazonaws.com/bucket/chave` — porque só a primeira é gerada
   * aqui: comparar apenas com ela deixaria arquivos antigos sem apagar.
   * Devolve `null` para uma URL de outro bucket ou de outro domínio.
   */
  extractKey(url: string): string | null {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }

    if (!parsed.hostname.endsWith('.amazonaws.com')) return null;

    const path = decodeURIComponent(parsed.pathname).replace(/^\//, '');
    if (!path) return null;

    // Virtual-hosted: o bucket é o primeiro rótulo do host.
    if (parsed.hostname.startsWith(`${this.bucketName}.s3`)) return path;

    // Path-style: o bucket é o primeiro segmento do caminho.
    const prefix = `${this.bucketName}/`;
    if (parsed.hostname.startsWith('s3.') && path.startsWith(prefix)) {
      return path.slice(prefix.length) || null;
    }

    return null;
  }

  async delete(url: string): Promise<void> {
    const key = this.extractKey(url);
    if (!key) {
      this.logger.warn(
        `Objeto não removido: a URL não aponta para o bucket ${this.bucketName} — ${url}`,
      );
      return;
    }

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    try {
      await this.s3Client.send(command);
      this.logger.debug(`Objeto removido do S3: ${key}`);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      // A remoção não derruba a operação de quem chamou: o registro fica no
      // log para que o objeto órfão possa ser encontrado depois.
      this.logger.error(
        `ÓRFÃO NO S3: falha ao remover a chave ${key} — ${error.message}`,
      );
    }
  }
}
