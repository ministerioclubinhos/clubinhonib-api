import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { AccessContext } from 'src/core/auth/auth.types';
import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AuthContextService } from 'src/core/auth/services/auth-context.service';

import { AcceptedChristResponseDto } from '../dtos/accepted-christ-response.dto';
import { CreateAcceptedChristDto } from '../dtos/create-accepted-christ.dto';
import { CreateAcceptedChristService } from '../services/create-accepted-christ.service';
import { DeleteAcceptedChristService } from '../services/delete-accepted-christ.service';

/**
 * O registro de que uma criança aceitou ou se reconciliou com Jesus.
 *
 * A rota exige sessão. Antes não tinha guard nenhum: qualquer pessoa na
 * internet gravava o registro em nome de qualquer criança.
 *
 * Ler o token é transporte: o caso de uso recebe só o papel e o id de quem
 * pediu.
 */
@Controller('accepted-christs')
@UseGuards(JwtAuthGuard)
export class AcceptedChristController {
  constructor(
    private readonly authContext: AuthContextService,
    private readonly createAcceptedChristService: CreateAcceptedChristService,
    private readonly deleteAcceptedChristService: DeleteAcceptedChristService,
  ) {}

  private contextOf(request: Request): Promise<AccessContext> {
    return this.authContext.resolveAccessContext(request);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateAcceptedChristDto,
    @Req() request: Request,
  ): Promise<AcceptedChristResponseDto> {
    return this.createAcceptedChristService.create(
      await this.contextOf(request),
      dto,
    );
  }

  /** Desfaz um registro lançado por engano. */
  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<{ message: string }> {
    return this.deleteAcceptedChristService.remove(
      await this.contextOf(request),
      id,
    );
  }
}
