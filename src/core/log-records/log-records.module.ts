import { Module } from '@nestjs/common';

import { LogRecordsController } from './log-records.controller';
import { DeleteLogRecordsService } from './services/delete-log-records.service';
import { GetLogRecordsService } from './services/get-log-records.service';

/** Leitura e exclusão administrativa dos registros; as portas são globais. */
@Module({
  controllers: [LogRecordsController],
  providers: [GetLogRecordsService, DeleteLogRecordsService],
})
export class LogRecordsModule {}
