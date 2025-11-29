import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('PagelasController (e2e)', () => {
  let app: INestApplication<App>;
  let authToken: string;
  let childId: string;
  let createdPagelaId: string;

  const SUPERUSER_EMAIL = 'superuser@clubinhonib.com';
  const SUPERUSER_PASSWORD = 'Abc@123';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableCors();
    await app.init();

    // Login para obter token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: SUPERUSER_EMAIL,
        password: SUPERUSER_PASSWORD,
      });

    authToken = loginResponse.body.accessToken;
    expect(authToken).toBeDefined();

    // Criar uma criança para usar nos testes
    const childResponse = await request(app.getHttpServer())
      .post('/children')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Criança Teste Pagela',
        birthDate: '2015-05-15',
        guardianName: 'Responsável Teste',
        gender: 'M',
        guardianPhone: '11999999999',
        isActive: true,
      });

    childId = childResponse.body.id;
    expect(childId).toBeDefined();
  });

  afterAll(async () => {
    // Limpar dados de teste
    if (createdPagelaId) {
      await request(app.getHttpServer())
        .delete(`/pagelas/${createdPagelaId}`)
        .set('Authorization', `Bearer ${authToken}`);
    }
    if (childId) {
      await request(app.getHttpServer())
        .delete(`/children/${childId}`)
        .set('Authorization', `Bearer ${authToken}`);
    }
    await app.close();
  });

  describe('POST /pagelas', () => {
    it('deve criar uma pagela com sucesso', async () => {
      const createDto = {
        childId: childId,
        referenceDate: '2024-01-15',
        present: true,
        didMeditation: true,
        recitedVerse: true,
        notes: 'Teste de criação de pagela',
      };

      const response = await request(app.getHttpServer())
        .post('/pagelas')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.id).toBeDefined();
      expect(response.body.childId).toBe(childId);
      expect(response.body.present).toBe(true);
      expect(response.body.didMeditation).toBe(true);
      expect(response.body.recitedVerse).toBe(true);
      expect(response.body.notes).toBe('Teste de criação de pagela');
      createdPagelaId = response.body.id;
    });

    it('deve criar uma pagela com week e year', async () => {
      const createDto = {
        childId: childId,
        referenceDate: '2024-02-20',
        week: 5,
        year: 2024,
        present: false,
        didMeditation: false,
        recitedVerse: false,
      };

      const response = await request(app.getHttpServer())
        .post('/pagelas')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.week).toBe(5);
      expect(response.body.year).toBe(2024);

      // Limpar
      await request(app.getHttpServer())
        .delete(`/pagelas/${response.body.id}`)
        .set('Authorization', `Bearer ${authToken}`);
    });

    it('deve criar uma pagela sem notes', async () => {
      const createDto = {
        childId: childId,
        referenceDate: '2024-03-10',
        present: true,
        didMeditation: true,
        recitedVerse: false,
      };

      const response = await request(app.getHttpServer())
        .post('/pagelas')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.childId).toBe(childId);

      // Limpar
      await request(app.getHttpServer())
        .delete(`/pagelas/${response.body.id}`)
        .set('Authorization', `Bearer ${authToken}`);
    });

    it('deve falhar ao criar sem campos obrigatórios', async () => {
      const createDto = {
        childId: childId,
        // Faltando referenceDate, present, etc
      };

      await request(app.getHttpServer())
        .post('/pagelas')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(400);
    });

    it('deve falhar ao criar com childId inválido', async () => {
      const createDto = {
        childId: 'invalid-uuid',
        referenceDate: '2024-01-15',
        present: true,
        didMeditation: true,
        recitedVerse: true,
      };

      await request(app.getHttpServer())
        .post('/pagelas')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(400);
    });

    it('deve falhar ao criar com week inválida', async () => {
      const createDto = {
        childId: childId,
        referenceDate: '2024-01-15',
        week: 60, // Inválido (máximo 53)
        present: true,
        didMeditation: true,
        recitedVerse: true,
      };

      await request(app.getHttpServer())
        .post('/pagelas')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(400);
    });
  });

  describe('GET /pagelas', () => {
    it('deve listar pagelas simples', async () => {
      const response = await request(app.getHttpServer())
        .get('/pagelas')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('deve listar pagelas com filtros', async () => {
      const response = await request(app.getHttpServer())
        .get('/pagelas')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ childId: childId })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /pagelas/paginated', () => {
    it('deve listar pagelas paginadas', async () => {
      const response = await request(app.getHttpServer())
        .get('/pagelas/paginated')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.data || response.body).toBeDefined();
    });
  });

  describe('GET /pagelas/:id', () => {
    it('deve buscar uma pagela por ID', async () => {
      if (!createdPagelaId) {
        // Criar uma pagela se não existir
        const createResponse = await request(app.getHttpServer())
          .post('/pagelas')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            childId: childId,
            referenceDate: '2024-04-01',
            present: true,
            didMeditation: true,
            recitedVerse: true,
          });
        createdPagelaId = createResponse.body.id;
      }

      const response = await request(app.getHttpServer())
        .get(`/pagelas/${createdPagelaId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.id).toBe(createdPagelaId);
    });
  });

  describe('PATCH /pagelas/:id', () => {
    it('deve atualizar uma pagela', async () => {
      if (!createdPagelaId) {
        const createResponse = await request(app.getHttpServer())
          .post('/pagelas')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            childId: childId,
            referenceDate: '2024-05-01',
            present: true,
            didMeditation: true,
            recitedVerse: true,
          });
        createdPagelaId = createResponse.body.id;
      }

      const updateDto = {
        present: false,
        notes: 'Atualizado via teste',
      };

      const response = await request(app.getHttpServer())
        .patch(`/pagelas/${createdPagelaId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.present).toBe(false);
      expect(response.body.notes).toBe('Atualizado via teste');
    });
  });

  describe('DELETE /pagelas/:id', () => {
    it('deve deletar uma pagela', async () => {
      // Criar uma pagela para deletar
      const createResponse = await request(app.getHttpServer())
        .post('/pagelas')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          childId: childId,
          referenceDate: '2024-06-01',
          present: true,
          didMeditation: true,
          recitedVerse: true,
        });

      const pagelaIdToDelete = createResponse.body.id;

      const response = await request(app.getHttpServer())
        .delete(`/pagelas/${pagelaIdToDelete}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });
});

