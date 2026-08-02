import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserRepository } from 'src/core/user/user.repository';
import { AppUnauthorizedException, ErrorCode } from 'src/shared/exceptions';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  tokenType?: 'access' | 'refresh';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly userRepository: UserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const { sub: userId, email, role } = payload;

    if (!userId || (payload.tokenType && payload.tokenType !== 'access')) {
      throw new AppUnauthorizedException(
        ErrorCode.TOKEN_INVALID,
        'Token de acesso inválido',
      );
    }

    const user = await this.userRepository.findById(userId);
    if (!user || !user.active || !user.refreshToken) {
      throw new AppUnauthorizedException(
        ErrorCode.TOKEN_INVALID,
        'Sessão inválida',
      );
    }

    if (!role) {
      this.logger.warn(`Missing role in JWT payload (userId: ${userId})`);
    }

    return { userId, email: user.email || email, role: user.role || role };
  }
}
