import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AwsS3Service } from './aws-s3.service';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [AwsS3Service],
    exports: [AwsS3Service],
})
export class AwsModule { }
