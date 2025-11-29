import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('ChildrenController (e2e)', () => {
  let app: INestApplication<App>;
  let authToken: string;
  let createdChildId: string;
  let clubId: string;

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

    // Criar um clube para usar nos testes
    const clubResponse = await request(app.getHttpServer())
      .post('/clubs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        number: 999,
        weekday: 'monday',
        time: '14:00',
        isActive: true,
        address: {
          street: 'Rua Teste',
          number: '123',
          district: 'Bairro Teste',
          city: 'São Paulo',
          state: 'SP',
          postalCode: '01234567',
        },
      });

    clubId = clubResponse.body.id;
    expect(clubId).toBeDefined();
  });

  afterAll(async () => {
    // Limpar dados de teste
    if (createdChildId) {
      await request(app.getHttpServer())
        .delete(`/children/${createdChildId}`)
        .set('Authorization', `Bearer ${authToken}`);
    }
    if (clubId) {
      await request(app.getHttpServer())
        .delete(`/clubs/${clubId}`)
        .set('Authorization', `Bearer ${authToken}`);
    }
    await app.close();
  });

  describe('POST /children', () => {
    it('deve criar uma criança com sucesso', async () => {
      const createDto = {
        name: 'João Silva',
        birthDate: '2015-05-15',
        guardianName: 'Maria Silva',
        gender: 'M',
        guardianPhone: '11999999999',
        isActive: true,
        clubId: clubId,
        address: {
          street: 'Rua das Flores',
          number: '456',
          district: 'Centro',
          city: 'São Paulo',
          state: 'SP',
          postalCode: '01234567',
          complement: 'Apto 12',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/children')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe('João Silva');
      expect(response.body.guardianName).toBe('Maria Silva');
      createdChildId = response.body.id;
    });

    it('deve criar uma criança sem endereço', async () => {
      const createDto = {
        name: 'Ana Costa',
        birthDate: '2016-03-20',
        guardianName: 'Pedro Costa',
        gender: 'F',
        guardianPhone: '11888888888',
        isActive: true,
      };

      const response = await request(app.getHttpServer())
        .post('/children')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.name).toBe('Ana Costa');

      // Limpar
      await request(app.getHttpServer())
        .delete(`/children/${response.body.id}`)
        .set('Authorization', `Bearer ${authToken}`);
    });

    it('deve falhar ao criar sem campos obrigatórios', async () => {
      const createDto = {
        name: 'Teste',
        // Faltando birthDate, guardianName, etc
      };

      await request(app.getHttpServer())
        .post('/children')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(400);
    });
  });

  describe('GET /children', () => {
    it('deve listar crianças paginadas', async () => {
      const response = await request(app.getHttpServer())
        .get('/children')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('deve listar crianças simples', async () => {
      const response = await request(app.getHttpServer())
        .get('/children/simple')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /children/:id', () => {
    it('deve buscar uma criança por ID', async () => {
      if (!createdChildId) {
        // Criar uma criança se não existir
        const createResponse = await request(app.getHttpServer())
          .post('/children')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Teste Get',
            birthDate: '2015-01-01',
            guardianName: 'Responsável',
            gender: 'M',
            guardianPhone: '11777777777',
          });
        createdChildId = createResponse.body.id;
      }

      const response = await request(app.getHttpServer())
        .get(`/children/${createdChildId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.id).toBe(createdChildId);
    });

    it('deve falhar ao buscar com ID inválido', async () => {
      await request(app.getHttpServer())
        .get('/children/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('PUT /children/:id', () => {
    it('deve atualizar uma criança', async () => {
      if (!createdChildId) {
        const createResponse = await request(app.getHttpServer())
          .post('/children')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Teste Update',
            birthDate: '2015-01-01',
            guardianName: 'Responsável',
            gender: 'M',
            guardianPhone: '11777777777',
          });
        createdChildId = createResponse.body.id;
      }

      const updateDto = {
        name: 'João Silva Atualizado',
        guardianPhone: '11999999999',
      };

      const response = await request(app.getHttpServer())
        .put(`/children/${createdChildId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.name).toBe('João Silva Atualizado');
    });
  });

  describe('PATCH /children/:id/toggle-active', () => {
    it('deve alternar o status ativo de uma criança', async () => {
      if (!createdChildId) {
        const createResponse = await request(app.getHttpServer())
          .post('/children')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Teste Toggle',
            birthDate: '2015-01-01',
            guardianName: 'Responsável',
            gender: 'M',
            guardianPhone: '11777777777',
          });
        createdChildId = createResponse.body.id;
      }

      const response = await request(app.getHttpServer())
        .patch(`/children/${createdChildId}/toggle-active`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.isActive).toBeDefined();
    });
  });

  describe('DELETE /children/:id', () => {
    it('deve deletar uma criança', async () => {
      // Criar uma criança para deletar
      const createResponse = await request(app.getHttpServer())
        .post('/children')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Teste Delete',
          birthDate: '2015-01-01',
          guardianName: 'Responsável',
          gender: 'M',
          guardianPhone: '11777777777',
        });

      const childIdToDelete = createResponse.body.id;

      const response = await request(app.getHttpServer())
        .delete(`/children/${childIdToDelete}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
    });
  });
});

