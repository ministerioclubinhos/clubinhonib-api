import { Injectable } from '@nestjs/common';
import { UserRepository } from '../user/user.repository';

@Injectable()
export class AuthRepository {
  constructor(private readonly userRepo: UserRepository) {}

  async validateUser(email: string, _password: string) {
    return this.userRepo.findByEmail(email);
  }
}
