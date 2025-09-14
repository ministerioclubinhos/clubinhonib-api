import { Injectable } from '@nestjs/common';
import { CoordinatorProfilesRepository } from '../repositories/coordinator-profiles.repository';
import {
  CoordinatorResponseDto,
  toCoordinatorDto,
} from '../dto/coordinator-profile.response.dto';
import { CoordinatorSimpleListDto } from '../dto/coordinator-simple-list.dto';
import { CoordinatorProfilesQueryDto, PageDto } from '../dto/coordinator-profiles.query.dto';

@Injectable()
export class CoordinatorProfilesService {
  constructor(private readonly repo: CoordinatorProfilesRepository) { }

    async findPage(query: CoordinatorProfilesQueryDto): Promise<PageDto<CoordinatorResponseDto>> {
      console.log("Buscando página com filtros:", query);

    const { items, total, page, limit } = await this.repo.findPageWithFilters(query);
    return {
      items: items.map(toCoordinatorDto),
      total,
      page,
      limit,
    };
  }

  async findAll(): Promise<CoordinatorResponseDto[]> {
    const coords = await this.repo.findAllWithClubsAndTeachers();
    return coords.map(toCoordinatorDto);
  }

  async list(): Promise<CoordinatorSimpleListDto[]> {
    return await this.repo.list();
  }

  async findOne(id: string): Promise<CoordinatorResponseDto> {
    const coord = await this.repo.findOneWithClubsAndTeachersOrFail(id);
    return toCoordinatorDto(coord);
  }

  async findByClubId(clubId: string): Promise<CoordinatorResponseDto> {
    const coord = await this.repo.findByClubIdWithTeachersOrFail(clubId);
    return toCoordinatorDto(coord);
  }

  async assignClub(coordinatorId: string, clubId: string): Promise<void> {
    await this.repo.assignClubToCoordinator(coordinatorId, clubId);
  }

  async unassignClub(coordinatorId: string, clubId: string): Promise<void> {
    await this.repo.unassignClubFromCoordinator(coordinatorId, clubId);
  }

  async moveClub(fromCoordinatorId: string, clubId: string, toCoordinatorId: string): Promise<void> {
    await this.repo.moveClubBetweenCoordinators(fromCoordinatorId, clubId, toCoordinatorId);
  }

  async createForUser(userId: string) {
    return this.repo.createForUser(userId);
  }
  async removeByUserId(userId: string) {
    return this.repo.removeByUserId(userId);
  }
}
