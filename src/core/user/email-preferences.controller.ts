import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import {
  EmailPreferencesResponseDto,
  UnsubscribeNoticesDto,
} from './dto/unsubscribe-notices.dto';
import { UpdateEmailPreferencesService } from './services/update-email-preferences.service';

/**
 * O descadastro dos avisos, a partir do link no rodapé do e-mail.
 *
 * Rota pública e sem sessão: quem clica no link de um e-mail antigo não está
 * logado. Quem autoriza é o token assinado, que não abre mais nada.
 *
 * É `POST`, e não `GET`: os provedores de e-mail abrem os links das mensagens
 * para checagem antes de a pessoa clicar, e um `GET` que já cancela
 * descadastraria quem nunca tocou no link.
 */
@Controller('email-preferences')
export class EmailPreferencesController {
  constructor(
    private readonly updateEmailPreferencesService: UpdateEmailPreferencesService,
  ) {}

  @Post('unsubscribe')
  @HttpCode(HttpStatus.OK)
  async unsubscribe(
    @Body() dto: UnsubscribeNoticesDto,
  ): Promise<EmailPreferencesResponseDto> {
    return this.updateEmailPreferencesService.unsubscribeFromNotices(dto.token);
  }
}
