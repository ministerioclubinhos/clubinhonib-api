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
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CreateUserService } from './services/create-user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RoleGuard } from 'src/auth/guards/role-guard';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { GetUsersService } from './services/get-user.service';
import { DeleteUserService } from './services/delete-user.service';
import { UpdateUserService } from './services/update-user.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(
    private readonly createUserService: CreateUserService,
    private readonly deleteUserService: DeleteUserService,
    private readonly updateUserService: UpdateUserService,
    private readonly getUsersService: GetUsersService
  ) {}

  @Post()
  async create(@Body() dto: CreateUserDto) {
    this.logger.debug('📥 [POST /users] Criando novo usuário');
    const result = await this.createUserService.create(dto);
    this.logger.log(`✅ Usuário criado: ID=${result.id}`);
    return result; // já sem campos sensíveis (service/repo não seleciona password nas respostas públicas)
  }

  @UseGuards(JwtAuthGuard, RoleGuard)
  @Get()
  findAll(@Query() query: GetUsersQueryDto) {
    return this.getUsersService.findAllPaginated(query);
  }

  @Get(':id')
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    this.logger.debug(`🔍 [GET /users/${id}] Buscando usuário`);
    return this.getUsersService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RoleGuard)
  @Put(':id')
  async update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateUserDto) {
    this.logger.debug(`✏️ [PUT /users/${id}] Atualizando usuário`);
    const result = await this.updateUserService.update(id, dto);
    this.logger.log(`✅ Usuário atualizado: ID=${id}`);
    return result;
  }

  @UseGuards(JwtAuthGuard, RoleGuard)
  @Delete(':id')
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    this.logger.debug(`🗑️ [DELETE /users/${id}] Removendo usuário`);
    await this.deleteUserService.remove(id);
    this.logger.log(`✅ Usuário removido: ID=${id}`);
    return { message: 'Usuário removido com sucesso' };
  }
}
