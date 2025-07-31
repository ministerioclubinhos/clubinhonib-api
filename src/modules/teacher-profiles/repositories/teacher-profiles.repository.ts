import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { TeacherProfileEntity } from '../entities/teacher-profile.entity/teacher-profile.entity';
import { ClubEntity } from 'src/modules/clubs/entities/club.entity/club.entity';
import { UserEntity } from 'src/user/user.entity';
import { TeacherSimpleListDto, toTeacherSimple } from '../dto/teacher-simple-list.dto';

@Injectable()
export class TeacherProfilesRepository {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(TeacherProfileEntity)
    private readonly teacherRepo: Repository<TeacherProfileEntity>,

    @InjectRepository(ClubEntity)
    private readonly clubRepo: Repository<ClubEntity>,

    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) { }

  /* READs */

  async findAllWithClubAndCoordinator(): Promise<TeacherProfileEntity[]> {
    return this.teacherRepo
      .createQueryBuilder('teacher')
      .leftJoinAndSelect('teacher.club', 'club')
      .leftJoinAndSelect('club.coordinator', 'coordinator')
      /* ↓↓↓ descer para os users ↓↓↓ */
      .leftJoin('teacher.user', 'teacher_user')
      .addSelect([
        'teacher_user.id',
        'teacher_user.name',
        'teacher_user.email',
        'teacher_user.phone',
        'teacher_user.active',
        'teacher_user.completed',
        'teacher_user.commonUser',
      ])
      .leftJoin('coordinator.user', 'coord_user')
      .addSelect([
        'coord_user.id',
        'coord_user.name',
        'coord_user.email',
        'coord_user.phone',
        'coord_user.active',
        'coord_user.completed',
        'coord_user.commonUser',
      ])
      .orderBy('teacher.createdAt', 'ASC')
      .addOrderBy('club.number', 'ASC')
      .getMany();
  }

  async findOneWithClubAndCoordinatorOrFail(id: string): Promise<TeacherProfileEntity> {
    const teacher = await this.teacherRepo
      .createQueryBuilder('teacher')
      .leftJoinAndSelect('teacher.club', 'club')
      .leftJoinAndSelect('club.coordinator', 'coordinator')
      /* ↓↓↓ descer para os users ↓↓↓ */
      .leftJoin('teacher.user', 'teacher_user')
      .addSelect([
        'teacher_user.id',
        'teacher_user.name',
        'teacher_user.email',
        'teacher_user.phone',
        'teacher_user.active',
        'teacher_user.completed',
        'teacher_user.commonUser',
      ])
      .leftJoin('coordinator.user', 'coord_user')
      .addSelect([
        'coord_user.id',
        'coord_user.name',
        'coord_user.email',
        'coord_user.phone',
        'coord_user.active',
        'coord_user.completed',
        'coord_user.commonUser',
      ])
      .where('teacher.id = :id', { id })
      .getOne();

    if (!teacher) throw new NotFoundException('TeacherProfile não encontrado');
    return teacher;
  }

  async findByClubIdWithCoordinator(clubId: string): Promise<TeacherProfileEntity[]> {
    const club = await this.clubRepo.findOne({ where: { id: clubId } });
    if (!club) throw new NotFoundException('Club não encontrado');

    return this.teacherRepo
      .createQueryBuilder('teacher')
      .leftJoinAndSelect('teacher.club', 'club')
      .leftJoinAndSelect('club.coordinator', 'coordinator')
      /* ↓↓↓ descer para os users ↓↓↓ */
      .leftJoin('teacher.user', 'teacher_user')
      .addSelect([
        'teacher_user.id',
        'teacher_user.name',
        'teacher_user.email',
        'teacher_user.phone',
        'teacher_user.active',
        'teacher_user.completed',
        'teacher_user.commonUser',
      ])
      .leftJoin('coordinator.user', 'coord_user')
      .addSelect([
        'coord_user.id',
        'coord_user.name',
        'coord_user.email',
        'coord_user.phone',
        'coord_user.active',
        'coord_user.completed',
        'coord_user.commonUser',
      ])
      .where('club.id = :clubId', { clubId })
      .orderBy('teacher.createdAt', 'ASC')
      .getMany();
  }

  /* WRITEs — inalterados */

  async assignTeacherToClub(teacherId: string, clubId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const txTeacherRepo = manager.withRepository(this.teacherRepo);
      const txClubRepo = manager.withRepository(this.clubRepo);

      const [teacher, club] = await Promise.all([
        txTeacherRepo.findOne({ where: { id: teacherId }, relations: { club: true } }),
        txClubRepo.findOne({ where: { id: clubId } }),
      ]);

      if (!teacher) throw new NotFoundException('TeacherProfile não encontrado');
      if (!club) throw new NotFoundException('Club não encontrado');

      if (teacher.club && teacher.club.id === clubId) return;

      if (teacher.club && teacher.club.id !== clubId) {
        throw new BadRequestException('Teacher já está vinculado a outro Club');
      }

      teacher.club = club;
      await txTeacherRepo.save(teacher);
    });
  }

  async unassignTeacherFromClub(teacherId: string, expectedClubId?: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const txTeacherRepo = manager.withRepository(this.teacherRepo);

      const teacher = await txTeacherRepo.findOne({
        where: { id: teacherId },
        relations: { club: true },
      });
      if (!teacher) throw new NotFoundException('TeacherProfile não encontrado');

      if (!teacher.club) return;

      if (expectedClubId && teacher.club.id !== expectedClubId) {
        throw new BadRequestException('Teacher não pertence ao club informado');
      }

      teacher.club = null as any;
      await txTeacherRepo.save(teacher);
    });
  }

  async createForUser(userId: string): Promise<TeacherProfileEntity> {
    return this.dataSource.transaction(async (manager) => {
      const txTeacher = manager.withRepository(this.teacherRepo);
      const txUser = manager.withRepository(this.userRepo);

      const user = await txUser.findOne({ where: { id: userId } });
      if (!user) throw new NotFoundException('User não encontrado');

      const existing = await txTeacher.findOne({ where: { user: { id: userId } } });
      if (existing) return existing;

      const entity = txTeacher.create({ user: user as any, active: true, club: null as any });
      return txTeacher.save(entity);
    });
  }

  async removeByUserId(userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const txTeacher = manager.withRepository(this.teacherRepo);
      const profile = await txTeacher.findOne({ where: { user: { id: userId } } });
      if (!profile) return;
      await txTeacher.delete(profile.id);
    });
  }

  async list(): Promise<TeacherSimpleListDto[]> {
    const items = await this.teacherRepo
      .createQueryBuilder('teacher')
      .leftJoin('teacher.user', 'user')
      .addSelect(['user.id', 'user.name', 'user.email'])
      .leftJoinAndSelect('teacher.club', 'club')
      .orderBy('teacher.createdAt', 'ASC')
      .getMany();

    return items.map(toTeacherSimple);
  }

}
