import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Endereço do site por ambiente, usado quando `SITE_BASE_URL` não é informado. */
const BASE_URL_BY_ENVIRONMENT: Record<string, string> = {
  local: 'http://localhost:5173',
  dev: 'http://localhost:5173',
  staging: 'https://staging.clubinhonib.com',
  production: 'https://clubinhonib.com',
};

const FALLBACK_BASE_URL = 'http://localhost:5173';

/**
 * Monta os links que saem nos e-mails.
 *
 * `SITE_BASE_URL` tem a palavra final; o mapa por ambiente é só a rede de
 * segurança. Antes o mapa era a única fonte e não tinha o caso `dev`, então o
 * ambiente de desenvolvimento mandava links apontando para `localhost`.
 */
@Injectable()
export class SiteUrlService {
  private readonly logger = new Logger(SiteUrlService.name);

  constructor(private readonly configService: ConfigService) {}

  get baseUrl(): string {
    const configured = this.configService.get<string>('SITE_BASE_URL');
    if (configured?.trim()) return configured.trim().replace(/\/+$/, '');

    const environment = this.configService.get<string>('ENVIRONMENT') ?? '';
    const mapped = BASE_URL_BY_ENVIRONMENT[environment];

    if (!mapped) {
      this.logger.warn(
        `SITE_BASE_URL não configurado e ENVIRONMENT="${environment}" desconhecido: usando ${FALLBACK_BASE_URL}.`,
      );
    }

    return mapped ?? FALLBACK_BASE_URL;
  }

  /** Ex.: `buildUrl('confirmar-email', token)` → `https://site/confirmar-email/<token>`. */
  buildUrl(...segments: string[]): string {
    const path = segments
      .map((segment) => segment.replace(/^\/+|\/+$/g, ''))
      .filter((segment) => segment.length > 0)
      .join('/');

    return `${this.baseUrl}/${path}`;
  }
}
