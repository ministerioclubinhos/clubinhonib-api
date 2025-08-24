// src/modules/teacher-profiles/services/teacher-profiles.service.ts
import { Injectable } from '@nestjs/common';
import { TeacherProfilesRepository } from '../repositories/teacher-profiles.repository';
import {
  TeacherResponseDto,
  toTeacherDto,
} from '../dto/teacher-profile.response.dto';

@Injectable()
export class TeacherProfilesService {
  constructor(private readonly repo: TeacherProfilesRepository) {}

  async findAll(): Promise<TeacherResponseDto[]> {
    const teachers = await this.repo.findAllWithClubAndCoordinator();
    return teachers.map(toTeacherDto);
  }

  async findOne(id: string): Promise<TeacherResponseDto> {
    const teacher = await this.repo.findOneWithClubAndCoordinatorOrFail(id);
    return toTeacherDto(teacher);
  }

  async findByClubId(clubId: string): Promise<TeacherResponseDto[]> {
    const teachers = await this.repo.findByClubIdWithCoordinator(clubId);
    return teachers.map(toTeacherDto);
  }

  async assignClub(teacherId: string, clubId: string): Promise<void> {
    await this.repo.assignTeacherToClub(teacherId, clubId);
  }

  async unassignClub(teacherId: string, expectedClubId?: string): Promise<void> {
    await this.repo.unassignTeacherFromClub(teacherId, expectedClubId);
  }
  async createForUser(userId: string) {
    return this.repo.createForUser(userId /* clubNumber? removido no user module */);
  }

  /** remove teacher profile do usuário (se existir) */
  async removeByUserId(userId: string) {
    return this.repo.removeByUserId(userId);
  }

}
