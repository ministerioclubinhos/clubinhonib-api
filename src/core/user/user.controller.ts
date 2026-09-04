import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';

import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';

import { CreateUserDto } from './dto/create-user.dto';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  PaginatedUsersResponseDto,
  UserResponseDto,
} from './dto/user-response.dto';
import { toUserResponse } from './mappers';
import { CreateUserService } from './services/create-user.service';
import { DeleteUserService } from './services/delete-user.service';
import { GetUsersService } from './services/get-user.service';
import { UpdateUserImageService } from './services/update-user-image.service';
import { UpdateUserService } from './services/update-user.service';

/**
 * Administração de usuários.
 *
 * Toda resposta passa por `toUserResponse`: a entidade carrega o hash da senha
 * e o refresh token, e nenhum deles pode sair daqui.
 */
@UseGuards(JwtAuthGuard, AdminRoleGuard)
@Controller('users')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(
    private readonly createUserService: CreateUserService,
    private readonly deleteUserService: DeleteUserService,
    private readonly updateUserService: UpdateUserService,
    private readonly getUsersService: GetUsersService,
    private readonly updateUserImageService: UpdateUserImageService,
  ) {}

  @Post()
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.createUserService.create(dto);
    this.logger.log(`Usuário criado: ${user.id}`);

    return toUserResponse(user);
  }

  @Get()
  findAll(
    @Query() query: GetUsersQueryDto,
  ): Promise<PaginatedUsersResponseDto> {
    return this.getUsersService.findAllPaginated(query);
  }

  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UserResponseDto> {
    return toUserResponse(await this.getUsersService.findOne(id));
  }

  /**
   * O administrador altera qualquer campo, inclusive a senha — e, para trocá-la,
   * não precisa informar a senha atual.
   */
  @Put(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.updateUserService.update(id, dto);
    this.logger.log(`Usuário atualizado: ${id}`);

    return toUserResponse(user);
  }

  @Delete(':id')
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<{ message: string }> {
    const result = await this.deleteUserService.remove(id);
    this.logger.log(`Usuário removido: ${id}`);

    return result;
  }

  @Patch(':id/image')
  @UseInterceptors(AnyFilesInterceptor())
  async updateImage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFiles() files: Express.Multer.File[] = [],
    @Body('imageData') imageDataRaw?: string,
    @Body() body?: Record<string, unknown>,
  ): Promise<UserResponseDto> {
    // A imagem chega como JSON puro ou como campo `imageData` do form-data.
    const payload = imageDataRaw ? { imageData: imageDataRaw } : (body ?? {});
    const user = await this.updateUserImageService.updateUserImage(
      id,
      payload,
      files,
    );
    this.logger.log(`Foto do usuário atualizada: ${id}`);

    return toUserResponse(user);
  }
}
