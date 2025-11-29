import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('ClubsController (e2e)', () => {
  let app: INestApplication<App>;
  let authToken: string;
  let createdClubId: string;

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
  });

  afterAll(async () => {
    // Limpar dados de teste
    if (createdClubId) {
      await request(app.getHttpServer())
        .delete(`/clubs/${createdClubId}`)
        .set('Authorization', `Bearer ${authToken}`);
    }
    await app.close();
  });

  describe('POST /clubs', () => {
    it('deve criar um clube com sucesso', async () => {
      const createDto = {
        number: 100,
        weekday: 'monday',
        time: '14:00',
        isActive: true,
        address: {
          street: 'Rua das Flores',
          number: '123',
          district: 'Centro',
          city: 'São Paulo',
          state: 'SP',
          postalCode: '01234567',
          complement: 'Sala 5',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/clubs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.id).toBeDefined();
      expect(response.body.number).toBe(100);
      expect(response.body.weekday).toBe('monday');
      expect(response.body.time).toBe('14:00');
      createdClubId = response.body.id;
    });

    it('deve criar um clube sem time', async () => {
      const createDto = {
        number: 101,
        weekday: 'tuesday',
        isActive: true,
        address: {
          street: 'Rua Teste',
          number: '456',
          district: 'Bairro Teste',
          city: 'São Paulo',
          state: 'SP',
          postalCode: '01234567',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/clubs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.number).toBe(101);

      // Limpar
      await request(app.getHttpServer())
        .delete(`/clubs/${response.body.id}`)
        .set('Authorization', `Bearer ${authToken}`);
    });

    it('deve falhar ao criar sem campos obrigatórios', async () => {
      const createDto = {
        number: 102,
        // Faltando weekday e address
      };

      await request(app.getHttpServer())
        .post('/clubs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(400);
    });

    it('deve falhar ao criar com time inválido', async () => {
      const createDto = {
        number: 103,
        weekday: 'wednesday',
        time: '25:00', // Hora inválida
        address: {
          street: 'Rua Teste',
          district: 'Bairro',
          city: 'São Paulo',
          state: 'SP',
          postalCode: '01234567',
        },
      };

      await request(app.getHttpServer())
        .post('/clubs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(400);
    });
  });

  describe('GET /clubs', () => {
    it('deve listar clubes paginados', async () => {
      const response = await request(app.getHttpServer())
        .get('/clubs')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('deve listar todos os clubes simples', async () => {
      const response = await request(app.getHttpServer())
        .get('/clubs/all')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('deve listar opções simples de clubes', async () => {
      const response = await request(app.getHttpServer())
        .get('/clubs/simple-options')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /clubs/:id', () => {
    it('deve buscar um clube por ID', async () => {
      if (!createdClubId) {
        // Criar um clube se não existir
        const createResponse = await request(app.getHttpServer())
          .post('/clubs')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            number: 200,
            weekday: 'thursday',
            time: '15:00',
            address: {
              street: 'Rua Get',
              district: 'Bairro',
              city: 'São Paulo',
              state: 'SP',
              postalCode: '01234567',
            },
          });
        createdClubId = createResponse.body.id;
      }

      const response = await request(app.getHttpServer())
        .get(`/clubs/${createdClubId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.id).toBe(createdClubId);
    });

    it('deve falhar ao buscar com ID inválido', async () => {
      await request(app.getHttpServer())
        .get('/clubs/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('PATCH /clubs/:id', () => {
    it('deve atualizar um clube', async () => {
      if (!createdClubId) {
        const createResponse = await request(app.getHttpServer())
          .post('/clubs')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            number: 300,
            weekday: 'friday',
            address: {
              street: 'Rua Update',
              district: 'Bairro',
              city: 'São Paulo',
              state: 'SP',
              postalCode: '01234567',
            },
          });
        createdClubId = createResponse.body.id;
      }

      const updateDto = {
        time: '16:00',
        isActive: false,
      };

      const response = await request(app.getHttpServer())
        .patch(`/clubs/${createdClubId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('PATCH /clubs/:id/toggle-active', () => {
    it('deve alternar o status ativo de um clube', async () => {
      if (!createdClubId) {
        const createResponse = await request(app.getHttpServer())
          .post('/clubs')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            number: 400,
            weekday: 'saturday',
            address: {
              street: 'Rua Toggle',
              district: 'Bairro',
              city: 'São Paulo',
              state: 'SP',
              postalCode: '01234567',
            },
          });
        createdClubId = createResponse.body.id;
      }

      const response = await request(app.getHttpServer())
        .patch(`/clubs/${createdClubId}/toggle-active`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.isActive).toBeDefined();
    });
  });

  describe('DELETE /clubs/:id', () => {
    it('deve deletar um clube', async () => {
      // Criar um clube para deletar
      const createResponse = await request(app.getHttpServer())
        .post('/clubs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          number: 500,
          weekday: 'monday',
          address: {
            street: 'Rua Delete',
            district: 'Bairro',
            city: 'São Paulo',
            state: 'SP',
            postalCode: '01234567',
          },
        });

      const clubIdToDelete = createResponse.body.id;

      const response = await request(app.getHttpServer())
        .delete(`/clubs/${clubIdToDelete}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });
});

