import { Injectable, Logger } from '@nestjs/common';
import { UserEntity } from '../entities/user.entity';
import { GetUsersQueryDto } from '../dto/get-users-query.dto';
import { UserRepository } from '../user.repository';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { PersonalDataRepository } from 'src/core/profile/repositories/personal-data.repository';
import { UserPreferencesRepository } from 'src/core/profile/repositories/user-preferences.repository';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';

@Injectable()
export class GetUsersService {
  private readonly logger = new Logger(GetUsersService.name);

  constructor(
    private readonly userRepo: UserRepository,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly personalDataRepository: PersonalDataRepository,
    private readonly userPreferencesRepository: UserPreferencesRepository,
  ) {}

  async findAllPaginated(q: GetUsersQueryDto) {
    return this.userRepo.findAllPaginated(q);
  }

  async findAlll(): Promise<UserEntity[]> {
    return this.userRepo.findAll();
  }

  async findOne(id: string): Promise<UserEntity> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new AppNotFoundException(
        ErrorCode.USER_NOT_FOUND,
        'Usuário não encontrado',
      );
    }
    return user;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepo.findByEmail(email);
  }

  async findOneForProfile(id: string) {
    const user = await this.userRepo.findByIdWithProfiles(id);
    if (!user) {
      throw new AppNotFoundException(
        ErrorCode.USER_NOT_FOUND,
        'Usuário não encontrado',
      );
    }

    const imageMedia = await this.mediaItemProcessor.findMediaItemByTarget(
      id,
      'UserEntity',
    );

    const personalData = await this.personalDataRepository.findByUserId(id);
    const preferences = await this.userPreferencesRepository.findByUserId(id);

    return this.buildProfileResponse(
      user,
      imageMedia || undefined,
      personalData,
      preferences,
    );
  }

  private buildProfileResponse(
    user: UserEntity,
    imageMedia?: any,
    personalData?: any,
    preferences?: any,
  ) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      active: user.active,
      completed: user.completed,
      commonUser: user.commonUser,
      phone: user.phone,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      role: user.role,
      cpf: user.cpf,
      image: imageMedia
        ? {
            id: imageMedia.id,
            title: imageMedia.title,
            description: imageMedia.description,
            url: imageMedia.url,
            uploadType: imageMedia.uploadType,
            mediaType: imageMedia.mediaType,
            isLocalFile: imageMedia.isLocalFile,
            platformType: imageMedia.platformType,
            originalName: imageMedia.originalName,
            size: imageMedia.size,
            createdAt: imageMedia.createdAt,
            updatedAt: imageMedia.updatedAt,
          }
        : null,
      personalData: personalData
        ? {
            birthDate: personalData.birthDate
              ? personalData.birthDate instanceof Date
                ? personalData.birthDate.toISOString().split('T')[0]
                : String(personalData.birthDate).split('T')[0]
              : undefined,
            gender: personalData.gender,
            gaLeaderName: personalData.gaLeaderName,
            gaLeaderContact: personalData.gaLeaderContact,
          }
        : undefined,
      preferences: preferences
        ? {
            loveLanguages: preferences.loveLanguages,
            temperaments: preferences.temperaments,
            favoriteColor: preferences.favoriteColor,
            favoriteFood: preferences.favoriteFood,
            favoriteMusic: preferences.favoriteMusic,
            whatMakesYouSmile: preferences.whatMakesYouSmile,
            skillsAndTalents: preferences.skillsAndTalents,
          }
        : undefined,
      teacherProfile: user.teacherProfile
        ? {
            id: user.teacherProfile.id,
            active: user.teacherProfile.active,
            club: user.teacherProfile.club
              ? {
                  id: user.teacherProfile.club.id,
                  number: user.teacherProfile.club.number,
                  weekday: user.teacherProfile.club.weekday,
                  time: user.teacherProfile.club.time,
                  isActive: user.teacherProfile.club.isActive,
                }
              : null,
          }
        : null,
      coordinatorProfile: user.coordinatorProfile
        ? {
            id: user.coordinatorProfile.id,
            active: user.coordinatorProfile.active,
            clubs: user.coordinatorProfile.clubs
              ? user.coordinatorProfile.clubs.map((club) => ({
                  id: club.id,
                  number: club.number,
                  weekday: club.weekday,
                  time: club.time,
                  isActive: club.isActive,
                }))
              : [],
          }
        : null,
    };
  }
}
