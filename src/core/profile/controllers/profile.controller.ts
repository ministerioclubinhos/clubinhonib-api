import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AuthContextService } from 'src/core/auth/services/auth-context.service';
import { AppUnauthorizedException, ErrorCode } from 'src/shared/exceptions';

import { CreateCompleteProfileDto } from '../dto/create-complete-profile.dto';
import { UpdateCompleteProfileDto } from '../dto/update-complete-profile.dto';
import { CompleteProfileResponseDto } from '../dto/complete-profile-response.dto';
import { QueryProfilesDto } from '../dto/query-profiles.dto';
import { PaginatedProfilesResponseDto } from '../dto/paginated-profiles-response.dto';
import { ProfileBirthdayResponseDto } from '../dto/profile-birthday-response.dto';
import { CreateProfileService } from '../services/profile/create-profile.service';
import { GetAllProfilesService } from '../services/profile/get-all-profiles.service';
import { GetOneProfileService } from '../services/profile/get-one-profile.service';
import { UpdateProfileService } from '../services/profile/update-profile.service';
import { DeleteProfileService } from '../services/profile/delete-profile.service';
import { ProfileAccessContext } from '../types';
import { assertCanListProfiles, assertCanManageOtherProfiles } from '../utils';

@Controller('profiles')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  private readonly logger = new Logger(ProfileController.name);

  constructor(
    private readonly authContext: AuthContextService,
    private readonly createProfileService: CreateProfileService,
    private readonly getAllProfilesService: GetAllProfilesService,
    private readonly getOneProfileService: GetOneProfileService,
    private readonly updateProfileService: UpdateProfileService,
    private readonly deleteProfileService: DeleteProfileService,
  ) {}

  /**
   * Quem está pedindo. Ler o token é transporte: os casos de uso recebem só o
   * papel e o id, nunca a requisição.
   */
  private async contextOf(request: Request): Promise<ProfileAccessContext> {
    const payload = await this.authContext.tryGetPayload(request);

    if (!payload?.sub) {
      throw new AppUnauthorizedException(
        ErrorCode.TOKEN_MISSING,
        'Sessão inválida',
      );
    }

    // O papel vai como veio: quem normaliza é `normalizeRole`.
    return { role: payload.role, userId: payload.sub };
  }

  @Post()
  async createProfile(
    @Req() request: Request,
    @Body() dto: CreateCompleteProfileDto,
  ): Promise<CompleteProfileResponseDto> {
    const { userId } = await this.contextOf(request);
    this.logger.debug('POST /profiles');

    return this.createProfileService.execute(userId as string, dto);
  }

  @Get()
  async getAllProfiles(
    @Req() request: Request,
    @Query() query: QueryProfilesDto,
  ): Promise<PaginatedProfilesResponseDto> {
    const context = await this.contextOf(request);
    assertCanListProfiles(context);
    this.logger.debug('GET /profiles');

    return this.getAllProfilesService.execute(context, query);
  }

  /**
   * Aniversariantes do mês.
   *
   * A faixa da tela usava a listagem completa com `limit=1000` para descobrir
   * isto, trazendo perfis inteiros de quem nem faz aniversário no mês.
   */
  @Get('birthdays')
  async getBirthdays(
    @Req() request: Request,
  ): Promise<ProfileBirthdayResponseDto[]> {
    const context = await this.contextOf(request);
    assertCanListProfiles(context);

    return this.getAllProfilesService.findBirthdaysOfCurrentMonth(context);
  }

  @Get('me')
  async getMyProfile(
    @Req() request: Request,
  ): Promise<CompleteProfileResponseDto> {
    const { userId } = await this.contextOf(request);
    return this.getOneProfileService.execute(userId as string);
  }

  @Put('me')
  async updateMyProfile(
    @Req() request: Request,
    @Body() dto: UpdateCompleteProfileDto,
  ): Promise<CompleteProfileResponseDto> {
    // Todo mundo edita o próprio perfil. A versão anterior liberava apenas
    // administrador, coordenador e professor, então o usuário comum recebia
    // 403 ao salvar os próprios dados em /meu-perfil.
    const { userId } = await this.contextOf(request);
    this.logger.debug('PUT /profiles/me');

    return this.updateProfileService.execute(userId as string, dto);
  }

  @Get(':id')
  async getProfileById(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<CompleteProfileResponseDto> {
    assertCanManageOtherProfiles(await this.contextOf(request));

    return this.getOneProfileService.execute(id);
  }

  @Put(':id')
  async updateProfileById(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompleteProfileDto,
    @Req() request: Request,
  ): Promise<CompleteProfileResponseDto> {
    assertCanManageOtherProfiles(await this.contextOf(request));
    this.logger.debug(`PUT /profiles/${id}`);

    return this.updateProfileService.execute(id, dto);
  }

  @Delete(':id')
  async deleteProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<{ message: string }> {
    assertCanManageOtherProfiles(await this.contextOf(request));
    this.logger.debug(`DELETE /profiles/${id}`);

    await this.deleteProfileService.execute(id);

    return { message: 'Perfil removido com sucesso' };
  }
}
