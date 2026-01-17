import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AwsS3Service } from './aws-s3.service';
import { AwsSESService } from './aws-ses.service';
import { SesIdentityService } from './ses-identity.service';
import { EmailService } from './email.service';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [AwsS3Service, AwsSESService, SesIdentityService, EmailService],
    exports: [AwsS3Service, AwsSESService, SesIdentityService, EmailService],
})
export class AwsModule { }
