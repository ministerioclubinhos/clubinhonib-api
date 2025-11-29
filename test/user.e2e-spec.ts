import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('UserController (e2e)', () => {
  let app: INestApplication<App>;
  let authToken: string;
  let createdUserId: string;

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
    if (createdUserId) {
      await request(app.getHttpServer())
        .delete(`/users/${createdUserId}`)
        .set('Authorization', `Bearer ${authToken}`);
    }
    await app.close();
  });

  describe('POST /users', () => {
    it('deve criar um usuário com sucesso', async () => {
      const createDto = {
        name: 'Usuário Teste',
        email: `teste.${Date.now()}@example.com`,
        password: 'Senha123@',
        phone: '11999999999',
        role: 'teacher',
        active: true,
        completed: true,
      };

      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe('Usuário Teste');
      expect(response.body.email).toBe(createDto.email);
      expect(response.body.role).toBe('teacher');
      createdUserId = response.body.id;
    });

    it('deve criar um usuário com role admin', async () => {
      const createDto = {
        name: 'Admin Teste',
        email: `admin.${Date.now()}@example.com`,
        password: 'Senha123@',
        phone: '11888888888',
        role: 'admin',
        active: true,
      };

      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.role).toBe('admin');

      // Limpar
      await request(app.getHttpServer())
        .delete(`/users/${response.body.id}`)
        .set('Authorization', `Bearer ${authToken}`);
    });

    it('deve criar um usuário com role coordinator', async () => {
      const createDto = {
        name: 'Coordinator Teste',
        email: `coordinator.${Date.now()}@example.com`,
        password: 'Senha123@',
        phone: '11777777777',
        role: 'coordinator',
        active: true,
      };

      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.role).toBe('coordinator');

      // Limpar
      await request(app.getHttpServer())
        .delete(`/users/${response.body.id}`)
        .set('Authorization', `Bearer ${authToken}`);
    });

    it('deve falhar ao criar sem campos obrigatórios', async () => {
      const createDto = {
        name: 'Teste',
        // Faltando email, password, phone
      };

      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(400);
    });

    it('deve falhar ao criar com email inválido', async () => {
      const createDto = {
        name: 'Teste',
        email: 'email-invalido',
        password: 'Senha123@',
        phone: '11999999999',
      };

      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(400);
    });

    it('deve falhar ao criar com senha muito curta', async () => {
      const createDto = {
        name: 'Teste',
        email: 'teste@example.com',
        password: '123', // Muito curta
        phone: '11999999999',
      };

      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(400);
    });
  });

  describe('GET /users', () => {
    it('deve listar usuários paginados', async () => {
      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.data || response.body).toBeDefined();
    });
  });

  describe('GET /users/:id', () => {
    it('deve buscar um usuário por ID', async () => {
      if (!createdUserId) {
        // Criar um usuário se não existir
        const createResponse = await request(app.getHttpServer())
          .post('/users')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Usuário Get',
            email: `get.${Date.now()}@example.com`,
            password: 'Senha123@',
            phone: '11666666666',
          });
        createdUserId = createResponse.body.id;
      }

      const response = await request(app.getHttpServer())
        .get(`/users/${createdUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.id).toBe(createdUserId);
    });

    it('deve falhar ao buscar com ID inválido', async () => {
      await request(app.getHttpServer())
        .get('/users/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('PUT /users/:id', () => {
    it('deve atualizar um usuário', async () => {
      if (!createdUserId) {
        const createResponse = await request(app.getHttpServer())
          .post('/users')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Usuário Update',
            email: `update.${Date.now()}@example.com`,
            password: 'Senha123@',
            phone: '11555555555',
          });
        createdUserId = createResponse.body.id;
      }

      const updateDto = {
        name: 'Usuário Atualizado',
        phone: '11444444444',
      };

      const response = await request(app.getHttpServer())
        .put(`/users/${createdUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.name).toBe('Usuário Atualizado');
      expect(response.body.phone).toBe('11444444444');
    });
  });

  describe('DELETE /users/:id', () => {
    it('deve deletar um usuário', async () => {
      // Criar um usuário para deletar
      const createResponse = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Usuário Delete',
          email: `delete.${Date.now()}@example.com`,
          password: 'Senha123@',
          phone: '11333333333',
        });

      const userIdToDelete = createResponse.body.id;

      const response = await request(app.getHttpServer())
        .delete(`/users/${userIdToDelete}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBeDefined();
    });
  });
});

