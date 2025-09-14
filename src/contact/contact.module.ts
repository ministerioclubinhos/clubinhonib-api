import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactEntity } from './contact.entity';
import { ContactRepository } from './contact.repository';
import { ContactService } from './contact.service';
import { ContactController } from './contact.controller';
import { AwsS3Service } from 'src/aws/aws-s3.service';

@Module({
  imports: [TypeOrmModule.forFeature([ContactEntity])],
  controllers: [ContactController],
  providers: [
    ContactService,
    ContactRepository,
    AwsS3Service,
  ],
})
export class ContactModule {}
