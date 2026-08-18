import {
  Controller,
  Post,
  Body,
  Request,
  UseGuards,
  Get,
  Logger,
  Query,
} from '@nestjs/common';
import { AuthRequest } from './auth.types';

import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RegisterUserDto } from './dto/register.dto';
import { CompleteUserDto } from './dto/complete-register.dto';
import { AuthService } from './services/auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LinkClubDto } from './dto/link-club.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import type { Request as ExpressRequest } from 'express';

import { PasswordRecoveryService } from './services/password-recovery.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly passwordRecoveryService: PasswordRecoveryService,
  ) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    this.logger.log('User login attempt');
    const result = await this.authService.login(dto);
    this.logger.log('User logged in successfully');
    return result;
  }

  @Post('google')
  async googleLogin(@Body() body: GoogleLoginDto) {
    this.logger.log('Google login attempt');
    const result = await this.authService.googleLogin(body.token);
    this.logger.log('Google login successful');
    return result;
  }

  @Post('refresh')
  async refresh(@Body() body: RefreshTokenDto) {
    this.logger.log('Token refresh attempt');
    const result = await this.authService.refreshToken(body.refreshToken);
    this.logger.log('Token refreshed successfully');
    return result;
  }

  @Post('logout')
  async logout(@Body() body: LogoutDto, @Request() req: ExpressRequest) {
    const authorization = req.headers.authorization;
    const accessToken = authorization?.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : undefined;
    const result = await this.authService.logout({
      refreshToken: body?.refreshToken,
      accessToken,
    });
    this.logger.log('User session revoked');
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Request() req: AuthRequest) {
    return this.authService.getMe(req.user.userId);
  }

  @Post('complete-register')
  async completeRegister(@Body() data: CompleteUserDto) {
    this.logger.log('Completing user registration');
    const result = await this.authService.completeRegister(data);
    this.logger.log('User registration completed successfully');
    return result;
  }

  @Post('register')
  async register(@Body() data: RegisterUserDto) {
    this.logger.log('Creating new user registration');
    const result = await this.authService.register(data);
    this.logger.log('User registered successfully');
    return result;
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    this.logger.log(`Password reset requested for: ${dto.email}`);
    const result = await this.passwordRecoveryService.forgotPassword(dto);
    this.logger.log(`Password reset processed for: ${dto.email}`);
    return result;
  }

  @Get('reset-password/validate')
  async validateResetToken(@Query('token') token: string) {
    this.logger.log(`Validating reset token`);
    return this.passwordRecoveryService.validateResetToken(token);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    this.logger.log(`Resetting password with token`);
    return this.passwordRecoveryService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('link-club')
  async linkClub(@Request() req: AuthRequest, @Body() dto: LinkClubDto) {
    this.logger.log(
      `Teacher ${req.user.userId} solicitou vínculo ao clubinho #${dto.clubNumber}`,
    );
    const result = await this.authService.linkTeacherToClub(
      req.user.userId,
      dto.clubNumber,
    );
    this.logger.log(
      `Teacher ${req.user.userId} vinculado ao clubinho #${dto.clubNumber}`,
    );
    return result;
  }
}
