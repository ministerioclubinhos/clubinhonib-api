import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });

    this.logger.debug('✅ JwtStrategy inicializada com sucesso');
  }

  async validate(payload: JwtPayload) {
    this.logger.debug('🔑 Payload recebido do JWT');
    this.logger.debug(`📦 Payload: ${JSON.stringify(payload)}`);

    const { sub: userId, email, role } = payload;

    if (!role) {
      this.logger.warn(`⚠️ Atenção: Role ausente no payload do JWT (userId: ${userId})`);
    } else {
      this.logger.log(`✅ Payload válido: userId=${userId}, role=${role}`);
    }

    return { userId, email, role };
  }
}
