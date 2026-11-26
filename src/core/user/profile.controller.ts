import {
  Body,
  Controller,
  Get,
  Logger,
  Patch,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';

import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AuthContextService } from 'src/core/auth/services/auth-context.service';

import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';
import { MyProfileResponseDto } from './dto/my-profile-response.dto';
import { ChangePasswordService } from './services/change-password.service';
import { UpdateOwnProfileService } from './services/update-own-profile.service';
import { UpdateUserImageService } from './services/update-user-image.service';
import { GetUsersService } from './services/get-user.service';

/**
 * A conta de quem está logado.
 *
 * Todas as rotas respondem `MyProfileResponseDto` — o mesmo contrato de
 * `GET /auth/me` — para a tela não precisar remontar o perfil depois de cada
 * alteração.
 */
@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  private readonly logger = new Logger(ProfileController.name);

  constructor(
    private readonly authContext: AuthContextService,
    private readonly getUsersService: GetUsersService,
    private readonly updateOwnProfileService: UpdateOwnProfileService,
    private readonly changePasswordService: ChangePasswordService,
    private readonly updateUserImageService: UpdateUserImageService,
  ) {}

  private async userIdOf(request: Request): Promise<string> {
    const payload = await this.authContext.getPayloadFromRequest(request);
    return payload.sub;
  }

  @Get()
  async getOwnProfile(@Req() request: Request): Promise<MyProfileResponseDto> {
    return this.getUsersService.findOneForProfile(await this.userIdOf(request));
  }

  @Patch()
  async updateOwnProfile(
    @Req() request: Request,
    @Body() dto: UpdateOwnProfileDto,
  ): Promise<MyProfileResponseDto> {
    const userId = await this.userIdOf(request);

    await this.updateOwnProfileService.updateOwnProfile(userId, dto);
    this.logger.log(`Perfil próprio atualizado: ${userId}`);

    return this.getUsersService.findOneForProfile(userId);
  }

  @Patch('password')
  async changePassword(
    @Req() request: Request,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const userId = await this.userIdOf(request);

    const result = await this.changePasswordService.changePassword(userId, dto);
    this.logger.log(`Senha alterada: ${userId}`);

    return result;
  }

  @Patch('image')
  @UseInterceptors(AnyFilesInterceptor())
  async updateOwnImage(
    @Req() request: Request,
    @UploadedFiles() files: Express.Multer.File[] = [],
    @Body('imageData') imageDataRaw?: string,
    @Body() body?: Record<string, unknown>,
  ): Promise<MyProfileResponseDto> {
    const userId = await this.userIdOf(request);

    // A imagem chega como JSON puro ou como campo `imageData` do form-data.
    const payload = imageDataRaw ? { imageData: imageDataRaw } : (body ?? {});
    await this.updateUserImageService.updateUserImage(userId, payload, files);
    this.logger.log(`Foto de perfil atualizada: ${userId}`);

    return this.getUsersService.findOneForProfile(userId);
  }
}
