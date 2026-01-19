import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID') ?? '';
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY') ?? '';
    this.environment = this.configService.get<string>('ENVIRONMENT') ?? '';

    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME') || '';
    if (!this.bucketName) {
      this.logger.error('AWS_S3_BUCKET_NAME not defined');
    }

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async upload(file: Express.Multer.File): Promise<string> {
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');

    const key = `${this.environment}/uploads/${Date.now()}_${sanitizedFilename}`;
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    try {
      await this.s3Client.send(command);
      return `https://${this.bucketName}.s3.amazonaws.com/${key}`;
    } catch (err) {
      this.logger.error(`Error uploading to S3: ${err.message}`);
      throw new Error('Error uploading to S3');
    }
  }

  async delete(url: string): Promise<void> {
    const key = url.split(`${this.bucketName}.s3.amazonaws.com/`)[1];
    if (!key) {
      this.logger.warn(`Could not extract S3 key from URL: ${url}`);
      return;
    }

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    try {
      await this.s3Client.send(command);
    } catch (err) {
      this.logger.error(`Error deleting from S3: ${err.message}`);
    }
  }
}
