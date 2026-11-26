import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthRequest } from 'src/core/auth/auth.types';
import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';

import {
  EmailPreferencesResponseDto,
  UnsubscribeNoticesDto,
} from './dto/unsubscribe-notices.dto';
import {
  MyEmailPreferencesResponseDto,
  UpdateMyEmailPreferencesDto,
} from './dto/my-email-preferences.dto';
import { GetEmailPreferencesService } from './services/get-email-preferences.service';
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
 *
 * `GET`/`PUT /me` são a mesma preferência vista de dentro do site: a chave
 * "Receber avisos por e-mail" nas configurações de notificação, com sessão.
 */
@Controller('email-preferences')
export class EmailPreferencesController {
  constructor(
    private readonly getEmailPreferencesService: GetEmailPreferencesService,
    private readonly updateEmailPreferencesService: UpdateEmailPreferencesService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async findMine(
    @Req() request: AuthRequest,
  ): Promise<MyEmailPreferencesResponseDto> {
    return this.getEmailPreferencesService.findMine(request.user.userId);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  async updateMine(
    @Req() request: AuthRequest,
    @Body() dto: UpdateMyEmailPreferencesDto,
  ): Promise<MyEmailPreferencesResponseDto> {
    return this.updateEmailPreferencesService.updateMine(
      request.user.userId,
      dto.noticesEnabled,
    );
  }

  @Post('unsubscribe')
  @HttpCode(HttpStatus.OK)
  async unsubscribe(
    @Body() dto: UnsubscribeNoticesDto,
  ): Promise<EmailPreferencesResponseDto> {
    return this.updateEmailPreferencesService.unsubscribeFromNotices(dto.token);
  }
}
