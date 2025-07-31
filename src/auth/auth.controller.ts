import { Controller, Post, Body, Request, UseGuards, Get } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RegisterUserDto } from './dto/register.dto';
import { CompleteUserDto } from './dto/complete-register.dto';
import { AuthService } from './services/auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('google')
  googleLogin(@Body() body: { token: string }) {
    return this.authService.googleLogin(body.token);
  }

  @Post('refresh')
  refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshToken(body.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Request() req) {
    return this.authService.logout(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Request() req) {
    return this.authService.getMe(req.user.userId);
  }

  @Post('complete-register')
  async completeRegister(@Body() data: CompleteUserDto) {
    return this.authService.completeRegister(data);
  }

  @Post('register')
  async register(@Body() data: RegisterUserDto) {
    return this.authService.register(data);
  }
}
