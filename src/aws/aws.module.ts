import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AwsS3Service } from './aws-s3.service';
import { AwsSesService } from './aws-ses.service';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [AwsS3Service, AwsSesService],
    exports: [AwsS3Service, AwsSesService],
})
export class AwsModule { }
