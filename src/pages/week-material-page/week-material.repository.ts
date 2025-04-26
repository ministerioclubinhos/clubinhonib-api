import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { WeekMaterialsPageEntity } from './entities/week-material-page.entity';

@Injectable()
export class WeekMaterialsPageRepository extends Repository<WeekMaterialsPageEntity> {
  constructor(private dataSource: DataSource) {
    super(WeekMaterialsPageEntity, dataSource.createEntityManager());
  }

  async findAllPages(): Promise<WeekMaterialsPageEntity[]> {
    return this.find({ relations: ['route'] });
  }

  async findOnePageById(id: string): Promise<WeekMaterialsPageEntity | null> {
    return this.findOne({
      where: { id },
      relations: ['route'],
    });
  }

  async findCurrentWeek(): Promise<WeekMaterialsPageEntity | null> {
    return this.findOne({
      where: { currentWeek : true },      
      relations: ['route'],
    });
  }

  async savePage(page: WeekMaterialsPageEntity): Promise<WeekMaterialsPageEntity> {
    return this.save(page);
  }

  async removePage(page: WeekMaterialsPageEntity): Promise<WeekMaterialsPageEntity> {
    return this.remove(page);
  }

  async upsertPage(
    id: string | undefined,
    pageData: Partial<WeekMaterialsPageEntity>,
  ): Promise<WeekMaterialsPageEntity> {
    if (id) {
      // Busca a entidade existente pelo ID
      const existingPage = await this.findOnePageById(id);
      if (existingPage) {
        // Atualiza os campos da entidade existente com os dados fornecidos
        Object.assign(existingPage, pageData);
        return this.save(existingPage);
      }
    }

    // Se não houver ID ou a entidade não existir, cria uma nova
    const newPage = this.create(pageData);
    return this.save(newPage);
  }
}