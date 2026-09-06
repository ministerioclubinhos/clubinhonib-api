import { IsISO8601 } from 'class-validator';

/**
 * Localiza o item a apagar. `occurredAt` faz parte da chave física no
 * DynamoDB (dia da partição e prefixo da ordenação); o `eventId` vem na rota.
 */
export class DeleteLogRecordQueryDto {
  @IsISO8601({ strict: true })
  occurredAt!: string;
}

/** Intervalo a apagar; mesmas regras de `from`/`to` da consulta. */
export class DeleteLogRecordsRangeDto {
  @IsISO8601({ strict: true })
  from!: string;

  @IsISO8601({ strict: true })
  to!: string;
}

export class DeleteLogRecordsResponseDto {
  /** Quantos itens saíram do storage. */
  deleted!: number;
}
