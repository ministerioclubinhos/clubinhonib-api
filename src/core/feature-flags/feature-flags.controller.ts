import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Query, Logger } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import { CreateFeatureFlagDto } from './dto/create-feature-flag.dto';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../auth/guards/role-guard';

@Controller('feature-flags')
export class FeatureFlagsController {
    private readonly logger = new Logger(FeatureFlagsController.name);

    constructor(private readonly service: FeatureFlagsService) { }

    @UseGuards(JwtAuthGuard, AdminRoleGuard)
    @Post()
    async create(@Body() dto: CreateFeatureFlagDto) {
        this.logger.log(`Creating feature flag: ${dto.key}`);
        const result = await this.service.create(dto);
        this.logger.log(`Feature flag created: ${dto.key}`);
        return result;
    }

    @Get()
    findAll() {
        this.logger.log('Fetching all feature flags');
        return this.service.findAll();
    }

    @UseGuards(JwtAuthGuard)
    @Get('check/:key')
    async check(@Param('key') key: string, @Query('environment') environment?: string) {
        this.logger.log(`Checking feature flag: ${key}, environment: ${environment || 'default'}`);
        const enabled = await this.service.isEnabled(key, environment);
        return { key, enabled, environment };
    }

    @UseGuards(JwtAuthGuard)
    @Get('environment/:environment')
    findByEnvironment(@Param('environment') environment: string) {
        this.logger.log(`Fetching feature flags for environment: ${environment}`);
        return this.service.findByEnvironment(environment);
    }

    @Get(':key')
    findOne(@Param('key') key: string) {
        this.logger.log(`Fetching feature flag: ${key}`);
        return this.service.findByKey(key);
    }

    @UseGuards(JwtAuthGuard, AdminRoleGuard)
    @Patch(':key')
    async update(@Param('key') key: string, @Body() dto: UpdateFeatureFlagDto) {
        this.logger.log(`Updating feature flag: ${key}`);
        const result = await this.service.update(key, dto);
        this.logger.log(`Feature flag updated: ${key}`);
        return result;
    }

    @UseGuards(JwtAuthGuard, AdminRoleGuard)
    @Patch(':key/toggle')
    async toggle(@Param('key') key: string) {
        this.logger.log(`Toggling feature flag: ${key}`);
        const result = await this.service.toggle(key);
        this.logger.log(`Feature flag toggled: ${key}`);
        return result;
    }

    @UseGuards(JwtAuthGuard, AdminRoleGuard)
    @Delete(':key')
    async remove(@Param('key') key: string) {
        this.logger.log(`Deleting feature flag: ${key}`);
        await this.service.remove(key);
        this.logger.log(`Feature flag deleted: ${key}`);
        return { message: `Feature flag "${key}" deleted successfully` };
    }
}
