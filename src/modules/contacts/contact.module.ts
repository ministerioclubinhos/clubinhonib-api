import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ContactEntity } from './entities/contact.entity';
import { ContactController } from './contact.controller';
import { ContactsRepository } from './repositories/contacts.repository';
import { CreateContactService } from './services/create-contact.service';
import { GetContactsService } from './services/get-contacts.service';
import { UpdateContactService } from './services/update-contact.service';
import { DeleteContactService } from './services/delete-contact.service';

@Module({
  imports: [TypeOrmModule.forFeature([ContactEntity])],
  controllers: [ContactController],
  providers: [
    ContactsRepository,
    CreateContactService,
    GetContactsService,
    UpdateContactService,
    DeleteContactService,
  ],
  exports: [GetContactsService],
})
export class ContactModule {}
