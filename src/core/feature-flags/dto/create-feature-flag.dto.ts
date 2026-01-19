import { IsString, IsBoolean, IsOptional, IsObject, MaxLength } from 'class-validator';

export class CreateFeatureFlagDto {
    @IsString()
    @MaxLength(255)
    key: string;

    @IsString()
    @MaxLength(255)
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsBoolean()
    @IsOptional()
    enabled?: boolean;

    @IsString()
    @MaxLength(50)
    @IsOptional()
    environment?: string;

    @IsObject()
    @IsOptional()
    metadata?: Record<string, any>;
}
