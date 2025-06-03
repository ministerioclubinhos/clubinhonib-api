import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RoleGuard } from 'src/auth/guards/role-guard';

@Controller('users')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  @Post()
  async create(@Body() dto: CreateUserDto) {
    this.logger.debug('📥 [POST /users] Criando novo usuário');
    const result = await this.userService.create(dto);
    this.logger.log(`✅ Usuário criado: ID=${result.id}`);
    return result;
  }

  @Get()
  async findAll() {
    this.logger.debug('📄 [GET /users] Listando todos os usuários');
    return this.userService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    this.logger.debug(`🔍 [GET /users/${id}] Buscando usuário`);
    return this.userService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RoleGuard)
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<CreateUserDto>) {
    this.logger.debug(`✏️ [PUT /users/${id}] Atualizando usuário`);
    const result = await this.userService.update(id, dto);
    this.logger.log(`✅ Usuário atualizado: ID=${id}`);
    return result;
  }

  @UseGuards(JwtAuthGuard, RoleGuard)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    this.logger.debug(`🗑️ [DELETE /users/${id}] Removendo usuário`);
    await this.userService.remove(id);
    this.logger.log(`✅ Usuário removido: ID=${id}`);
    return { message: 'Usuário removido com sucesso' };
  }
}
