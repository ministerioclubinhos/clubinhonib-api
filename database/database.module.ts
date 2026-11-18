import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseLoggerService } from './database-logger.service';
import { DATABASE_ENTITIES } from '../src/database/entities';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.ENV_FILE || '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('DatabaseModule');
        const dbConfig = {
          type: 'mysql' as const,
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: configService.get<number>('DB_PORT', 3306),
          username: configService.get<string>('DB_USERNAME', 'root'),
          password: configService.get<string>('DB_PASSWORD', ''),
          database: configService.get<string>('DB_NAME', 'test'),
          entities: DATABASE_ENTITIES,
          /** Durante esta fase do produto, mudanças nas entidades são
           * sincronizadas automaticamente pelo TypeORM na inicialização. */
          synchronize:
            configService.get<string>('DB_SYNCHRONIZE', 'true') === 'true',
        };

        if (dbConfig.synchronize) {
          logger.warn(
            'DB_SYNCHRONIZE=true: mudanças nas entidades serão aplicadas automaticamente.',
          );
        }

        logger.debug(`Tentando conectar ao banco de dados MySQL:
           → Host: ${dbConfig.host}
           → Porta: ${dbConfig.port}
           → DB: ${dbConfig.database}
           → Usuário: ${dbConfig.username}`);

        return dbConfig;
      },
    }),
  ],
  providers: [DatabaseLoggerService],
})
export class DatabaseModule {}
