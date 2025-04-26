import {
  Controller,
  Get,
  Delete,
  Param,
  Logger,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { RouteService } from './route.service';
import { RouteEntity } from './route-page.entity';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('routes')
export class RouteController {
  private readonly logger = new Logger(RouteController.name);

  constructor(private readonly routeService: RouteService) {}

  @Get()
  async findAll(): Promise<RouteEntity[]> {
    const routes = await this.routeService.findAllRoutes();
    this.logger.debug(`📦 Rotas retornadas: ${routes.length}`);
    return routes;
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<RouteEntity> {
    const route = await this.routeService.findById(id);
    if (!route) {
      this.logger.warn(`⚠️ Rota ID=${id} não encontrada`);
      throw new NotFoundException('Rota não encontrada');
    }
    return route;
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async removeRoute(@Param('id') id: string) {
    await this.routeService.removeRoute(id);
    this.logger.log(`🗑️ Rota ID=${id} removida`);
    return { message: `Rota ID=${id} removida com sucesso` };
  }
}
