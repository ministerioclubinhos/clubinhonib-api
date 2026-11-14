/**
 * Semeia o superusuário e os usuários de desenvolvimento (admin, coordenador, professor)
 * direto no banco local com seus respectivos perfis (coordinator_profiles / teacher_profiles).
 *
 * `POST /auth/register` cria a conta inativa (pede confirmação de e-mail) e
 * `POST /users` exige um administrador logado — sem um admin conhecido não há
 * como bootstrapar a suíte pela API. Este script lê `env/local.env` (ou o ENV_FILE configurado),
 * conecta no MySQL e faz o upsert das contas básicas de desenvolvimento.
 * Só roda contra `localhost`/`127.0.0.1`/`::1`.
 *
 * Uso: `node scripts/automations/bootstrap/seed-superuser.js`
 */
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');

const { ENV_FILE, SUPERUSER_EMAIL, SUPERUSER_PASSWORD, DEFAULT_PASSWORD } = require('../common/config');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/** Parser mínimo de `.env`: `KEY=VALUE`, comentários e aspas simples/duplas. */
function parseEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const env = {};
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function requireFromApi(name) {
  // As dependências (mysql2, bcryptjs) são as da própria API.
  return require(require.resolve(name, { paths: [path.resolve(__dirname, '../../..')] }));
}

const DEV_USERS = [
  {
    key: 'superuser',
    email: SUPERUSER_EMAIL || 'superuser@clubinhonib.com',
    password: SUPERUSER_PASSWORD || 'Abc@123',
    name: 'Superusuário Automação',
    phone: '11999990000',
    role: 'admin',
  },
  {
    key: 'admin',
    email: 'admin@clubinhonib.com',
    password: DEFAULT_PASSWORD || 'Senha123@',
    name: 'Administrador Local',
    phone: '11999990001',
    role: 'admin',
  },
  {
    key: 'coordinator',
    email: 'coordenador@clubinhonib.com',
    password: DEFAULT_PASSWORD || 'Senha123@',
    name: 'Coordenador Local',
    phone: '11999990002',
    role: 'coordinator',
    hasCoordinatorProfile: true,
  },
  {
    key: 'teacher',
    email: 'professor@clubinhonib.com',
    password: DEFAULT_PASSWORD || 'Senha123@',
    name: 'Professor Local',
    phone: '11999990003',
    role: 'teacher',
    hasTeacherProfile: true,
  },
];

async function seedSuperuser({ logger = console, email = SUPERUSER_EMAIL, password = SUPERUSER_PASSWORD } = {}) {
  const envFilePath = process.env.ENV_FILE || ENV_FILE;
  const env = { ...parseEnvFile(envFilePath), ...process.env };
  const host = env.DB_HOST || 'localhost';
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`Recusado: o seed de usuários só roda contra banco local (DB_HOST=${host}).`);
  }

  const mysql = requireFromApi('mysql2/promise');
  const bcrypt = requireFromApi('bcryptjs');

  let connection;
  try {
    connection = await mysql.createConnection({
      host,
      port: Number(env.DB_PORT || 3306),
      user: env.DB_USERNAME,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
    });
  } catch (err) {
    logger.warn?.(`[bootstrap/seed-superuser] Não foi possível conectar ao MySQL (${host}:${env.DB_PORT}): ${err.message}`);
    return { id: null, created: false, error: err.message };
  }

  try {
    // Garante que as tabelas mínimas existam no MySQL caso o TypeORM synchronize ainda não tenha rodado
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        completed TINYINT(1) NOT NULL DEFAULT 1,
        commonUser TINYINT(1) NOT NULL DEFAULT 1,
        role VARCHAR(50) NOT NULL DEFAULT 'teacher',
        cpf VARCHAR(255) NULL,
        refreshToken TEXT NULL,
        noticesUnsubscribedAt DATETIME NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS coordinator_profiles (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        active TINYINT(1) NOT NULL DEFAULT 1,
        user_id VARCHAR(36) NOT NULL UNIQUE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS teacher_profiles (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        active TINYINT(1) NOT NULL DEFAULT 1,
        club_id VARCHAR(36) NULL,
        user_id VARCHAR(36) NOT NULL UNIQUE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    let superuserResult = { id: null, created: false };

    for (const spec of DEV_USERS) {
      // Se parêmetros customizados de email/senha foram passados para o superuser
      const userEmail = spec.key === 'superuser' ? email : spec.email;
      const userPassword = spec.key === 'superuser' ? password : spec.password;

      const hash = await bcrypt.hash(userPassword, 10);
      const [rows] = await connection.execute('SELECT id, role, active FROM users WHERE email = ? LIMIT 1', [userEmail]);

      let userId;
      let isNew = false;

      if (rows.length > 0) {
        userId = rows[0].id;
        await connection.execute(
          "UPDATE users SET password = ?, name = ?, phone = ?, role = ?, active = 1, completed = 1, commonUser = 1, refreshToken = NULL, updatedAt = NOW(6) WHERE id = ?",
          [hash, spec.name, spec.phone, spec.role, userId],
        );
        logger.info(`[bootstrap/seed-superuser] Usuário atualizado (${spec.role}): ${userEmail} id=${userId}`);
      } else {
        userId = crypto.randomUUID();
        isNew = true;
        await connection.execute(
          "INSERT INTO users (id, createdAt, updatedAt, email, password, phone, name, active, completed, commonUser, role) VALUES (?, NOW(6), NOW(6), ?, ?, ?, ?, 1, 1, 1, ?)",
          [userId, userEmail, hash, spec.phone, spec.name, spec.role],
        );
        logger.info(`[bootstrap/seed-superuser] Usuário criado (${spec.role}): ${userEmail} id=${userId}`);
      }

      if (spec.key === 'superuser') {
        superuserResult = { id: userId, created: isNew };
      }

      // Cria/garante o perfil correspondente
      if (spec.hasCoordinatorProfile) {
        const [cpRows] = await connection.execute('SELECT id FROM coordinator_profiles WHERE user_id = ? LIMIT 1', [userId]);
        if (cpRows.length === 0) {
          const cpId = crypto.randomUUID();
          await connection.execute(
            'INSERT INTO coordinator_profiles (id, createdAt, updatedAt, active, user_id) VALUES (?, NOW(6), NOW(6), 1, ?)',
            [cpId, userId],
          );
          logger.info(`[bootstrap/seed-superuser] CoordinatorProfile criado para ${userEmail}`);
        }
      }

      if (spec.hasTeacherProfile) {
        const [tpRows] = await connection.execute('SELECT id FROM teacher_profiles WHERE user_id = ? LIMIT 1', [userId]);
        if (tpRows.length === 0) {
          const tpId = crypto.randomUUID();
          await connection.execute(
            'INSERT INTO teacher_profiles (id, createdAt, updatedAt, active, user_id) VALUES (?, NOW(6), NOW(6), 1, ?)',
            [tpId, userId],
          );
          logger.info(`[bootstrap/seed-superuser] TeacherProfile criado para ${userEmail}`);
        }
      }
    }

    return superuserResult;
  } finally {
    if (connection) await connection.end();
  }
}

if (require.main === module) {
  seedSuperuser()
    .then((r) => {
      console.log('✅ Seeding de usuários concluído com sucesso:');
      console.log(JSON.stringify(r, null, 2));
    })
    .catch((err) => {
      console.error('❌ Erro no seeding:', err.message);
      process.exit(1);
    });
}

module.exports = { seedSuperuser, seedDevUsers: seedSuperuser, parseEnvFile };
