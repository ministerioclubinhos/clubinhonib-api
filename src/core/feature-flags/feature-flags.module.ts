import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlagEntity } from './entities/feature-flag.entity';
import { FeatureFlagsRepository } from './feature-flags.repository';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagsController } from './feature-flags.controller';
import { FeatureFlagGuard } from './guards/feature-flag.guard';

@Module({
    imports: [TypeOrmModule.forFeature([FeatureFlagEntity])],
    controllers: [FeatureFlagsController],
    providers: [FeatureFlagsRepository, FeatureFlagsService, FeatureFlagGuard],
    exports: [FeatureFlagsService, FeatureFlagGuard],
})
export class FeatureFlagsModule { }
