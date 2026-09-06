/**
 * Semeia o superusuário direto no banco local.
 *
 * `POST /auth/register` cria a conta inativa (pede confirmação de e-mail) e
 * `POST /users` exige um administrador logado — sem um admin conhecido não há
 * como bootstrapar a suíte pela API. Este script lê `env/local.env`, conecta
 * no MySQL e faz o upsert de `SUPERUSER_EMAIL` como admin ativo com a senha
 * `SUPERUSER_PASSWORD`. Só roda contra `localhost`/`127.0.0.1`.
 *
 * Uso: `node scripts/automations/bootstrap/seed-superuser.js`
 */
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');

const { ENV_FILE, SUPERUSER_EMAIL, SUPERUSER_PASSWORD } = require('../common/config');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/** Parser mínimo de `.env`: `KEY=VALUE`, comentários e aspas simples/duplas. */
function parseEnvFile(file) {
  if (!fs.existsSync(file)) throw new Error(`Arquivo de ambiente não encontrado: ${file}`);
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

async function seedSuperuser({ logger = console, email = SUPERUSER_EMAIL, password = SUPERUSER_PASSWORD } = {}) {
  const env = { ...parseEnvFile(ENV_FILE), ...process.env };
  const host = env.DB_HOST || 'localhost';
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`Recusado: o seed do superusuário só roda contra banco local (DB_HOST=${host}).`);
  }

  const mysql = requireFromApi('mysql2/promise');
  const bcrypt = requireFromApi('bcryptjs');

  const connection = await mysql.createConnection({
    host,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });

  try {
    const hash = await bcrypt.hash(password, 10);
    const [rows] = await connection.execute('SELECT id, role, active FROM users WHERE email = ? LIMIT 1', [email]);

    if (rows.length > 0) {
      await connection.execute(
        "UPDATE users SET password = ?, role = 'admin', active = 1, completed = 1, commonUser = 1, refreshToken = NULL, updatedAt = NOW(6) WHERE id = ?",
        [hash, rows[0].id],
      );
      logger.info(`[bootstrap/seed-superuser] superusuário atualizado (${email}) id=${rows[0].id}`);
      return { id: rows[0].id, created: false };
    }

    const id = crypto.randomUUID();
    await connection.execute(
      "INSERT INTO users (id, createdAt, updatedAt, email, password, phone, name, active, completed, commonUser, role) VALUES (?, NOW(6), NOW(6), ?, ?, ?, ?, 1, 1, 1, 'admin')",
      [id, email, hash, '11999990000', 'Superusuário Automação'],
    );
    logger.info(`[bootstrap/seed-superuser] superusuário criado (${email}) id=${id}`);
    return { id, created: true };
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  seedSuperuser()
    .then((r) => {
      console.log(JSON.stringify(r));
    })
    .catch((err) => {
      console.error('❌', err.message);
      process.exit(1);
    });
}

module.exports = { seedSuperuser, parseEnvFile };
