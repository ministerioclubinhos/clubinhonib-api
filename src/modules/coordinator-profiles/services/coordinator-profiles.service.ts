// src/modules/coordinator-profiles/services/coordinator-profiles.service.ts
import { Injectable } from '@nestjs/common';
import { CoordinatorProfilesRepository } from '../repositories/coordinator-profiles.repository';
import {
  CoordinatorResponseDto,
  toCoordinatorDto,
} from '../dto/coordinator-profile.response.dto';
import { CoordinatorSimpleListDto } from '../dto/coordinator-simple-list.dto';

@Injectable()
export class CoordinatorProfilesService {
  constructor(private readonly repo: CoordinatorProfilesRepository) { }

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

  /** remove coordinator profile do usuário (e zera seus clubs no próprio repo) */
  async removeByUserId(userId: string) {
    return this.repo.removeByUserId(userId);
  }
}
