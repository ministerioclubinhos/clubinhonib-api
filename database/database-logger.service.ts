import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseLoggerService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Database');

  constructor(private dataSource: DataSource) {}

  async onApplicationBootstrap() {
    try {
      if (this.dataSource.isInitialized) {
        this.logger.debug('✅ Conexão com o banco de dados estabelecida com sucesso!');
      } else {
        this.logger.warn('⚠️ Banco de dados ainda não está inicializado');
      }
    } catch (error) {
      this.logger.error('❌ Erro ao verificar conexão com o banco:', error);
    }
  }
}
