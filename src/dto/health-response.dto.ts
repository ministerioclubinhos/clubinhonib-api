/** Contrato da sonda de saúde (`GET /health`). */
export class HealthResponseDto {
  status: 'ok';
  /** Momento da resposta, em ISO 8601. */
  timestamp: string;
  /** Segundos desde que o processo subiu. */
  uptime: number;
  /** `'unknown'` quando `ENVIRONMENT` não está definida. */
  environment: string;
}
