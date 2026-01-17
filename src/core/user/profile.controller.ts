import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UseGuards,
  Logger,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AuthContextService } from 'src/core/auth/services/auth-context.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';
import { ChangePasswordService } from './services/change-password.service';
import { UpdateOwnProfileService } from './services/update-own-profile.service';
import { UpdateUserImageService } from './services/update-user-image.service';
import { GetUsersService } from './services/get-user.service';

@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  private readonly logger = new Logger(ProfileController.name);

  constructor(
    private readonly authContextService: AuthContextService,
    private readonly getUsersService: GetUsersService,
    private readonly updateOwnProfileService: UpdateOwnProfileService,
    private readonly changePasswordService: ChangePasswordService,
    private readonly updateUserImageService: UpdateUserImageService,
  ) { }

  @Get()
  async getOwnProfile(@Req() req: Request) {
    const payload = await this.authContextService.getPayloadFromRequest(req);
    const userId = payload.sub;

    return this.getUsersService.findOneForProfile(userId);
  }

  @Patch()
  async updateOwnProfile(
    @Req() req: Request,
    @Body() dto: UpdateOwnProfileDto,
  ) {
    const payload = await this.authContextService.getPayloadFromRequest(req);
    const userId = payload.sub;

    this.logger.log(`Updating own profile: ${userId}`);
    await this.updateOwnProfileService.updateOwnProfile(userId, dto);
    this.logger.log(`Own profile updated successfully: ${userId}`);
    return this.getUsersService.findOneForProfile(userId);
  }

  @Patch('password')
  async changePassword(
    @Req() req: Request,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const payload = await this.authContextService.getPayloadFromRequest(req);
    const userId = payload.sub;

    this.logger.log(`Changing password for user: ${userId}`);
    const result = await this.changePasswordService.changePassword(userId, dto);
    this.logger.log(`Password changed successfully: ${userId}`);
    return result;
  }

  @Patch('image')
  @UseInterceptors(AnyFilesInterceptor())
  async updateOwnImage(
    @Req() req: Request,
    @UploadedFiles() files: Express.Multer.File[] = [],
    @Body('imageData') imageDataRaw?: string,
    @Body() body?: any,
  ) {
    const payload = await this.authContextService.getPayloadFromRequest(req);
    const userId = payload.sub;

    this.logger.log(`Updating own profile image: ${userId}`);
    const bodyToProcess = imageDataRaw ? { imageData: imageDataRaw } : (body || {});
    await this.updateUserImageService.updateUserImage(userId, bodyToProcess, files);
    this.logger.log(`Own profile image updated successfully: ${userId}`);
    return this.getUsersService.findOneForProfile(userId);
  }
}

