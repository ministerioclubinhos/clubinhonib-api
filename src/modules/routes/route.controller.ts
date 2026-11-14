import { Controller, Get, Param, Logger } from '@nestjs/common';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { GetRouteService } from './services/get-route.service';
import { RouteResponseDto } from './dto/route-response.dto';
import { toRouteResponse, toRouteResponseList } from './mappers';

@Controller('routes')
export class RouteController {
  private readonly logger = new Logger(RouteController.name);

  constructor(private readonly getRouteService: GetRouteService) {}

  @Get()
  async findAll(): Promise<RouteResponseDto[]> {
    const routes = await this.getRouteService.findAllRoutes();
    this.logger.debug(`📦 Rotas retornadas: ${routes.length}`);
    return toRouteResponseList(routes);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<RouteResponseDto> {
    const route = await this.getRouteService.findById(id);
    if (!route) {
      this.logger.warn(`⚠️ Rota ID=${id} não encontrada`);
      throw new AppNotFoundException(
        ErrorCode.ROUTE_NOT_FOUND,
        'Rota não encontrada',
      );
    }
    return toRouteResponse(route);
  }
}
