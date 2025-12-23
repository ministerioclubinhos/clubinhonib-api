import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('AcceptedChristController (e2e)', () => {
  let app: INestApplication<App>;
  let authToken: string;
  let childId: string;

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
        name: 'Criança Teste Accepted Christ',
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
    // Limpar dados de teste se necessário
    if (childId) {
      await request(app.getHttpServer())
        .delete(`/children/${childId}`)
        .set('Authorization', `Bearer ${authToken}`);
    }
    await app.close();
  });

  describe('POST /accepted-christs', () => {
    it('deve criar um accepted christ com sucesso', async () => {
      const createDto = {
        childId: childId,
        decision: 'ACCEPTED',
        notes: 'Teste de criação de accepted christ',
      };

      const response = await request(app.getHttpServer())
        .post('/accepted-christs')
        .send(createDto)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.id).toBeDefined();
      expect(response.body.childId).toBe(childId);
      expect(response.body.decision).toBe('ACCEPTED');
      expect(response.body.notes).toBe('Teste de criação de accepted christ');
    });

    it('deve criar um accepted christ com RECONCILED', async () => {
      const createDto = {
        childId: childId,
        decision: 'RECONCILED',
        notes: 'Teste de reconciled',
      };

      const response = await request(app.getHttpServer())
        .post('/accepted-christs')
        .send(createDto)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.decision).toBe('RECONCILED');
    });

    it('deve criar um accepted christ sem notes', async () => {
      const createDto = {
        childId: childId,
        decision: 'ACCEPTED',
      };

      const response = await request(app.getHttpServer())
        .post('/accepted-christs')
        .send(createDto)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.childId).toBe(childId);
    });

    it('deve falhar ao criar com childId inválido', async () => {
      const createDto = {
        childId: 'invalid-uuid',
        decision: 'ACCEPTED',
      };

      await request(app.getHttpServer())
        .post('/accepted-christs')
        .send(createDto)
        .expect(400);
    });

    it('deve falhar ao criar sem childId', async () => {
      const createDto = {
        decision: 'ACCEPTED',
      };

      await request(app.getHttpServer())
        .post('/accepted-christs')
        .send(createDto)
        .expect(400);
    });
  });
});

