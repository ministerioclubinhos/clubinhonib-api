/**
 * Usuários fixos de cada papel e um cliente HTTP logado para cada um.
 *
 * É a base da cobertura por cenário: cada módulo roda o caminho feliz como
 * admin e depois confere o que coordenador, professor e anônimo podem ou não
 * fazer. Idempotente: procura pelo e-mail antes de criar.
 */
const { ROLE_USERS, DEFAULT_PASSWORD } = require('./config');
const { loginAs } = require('./http');
const { errorMessage, errorStatus } = require('./errors');
const { randomPhone } = require('./random');

async function findUserByEmail(http, email) {
  const res = await http.request('get', '/users', { params: { q: email, page: 1, limit: 20 } });
  const items = res.data?.items ?? [];
  return items.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

/** Garante a conta com o estado esperado (papel, ativo, senha padrão). */
/**
 * `GET /users` não lista administradores (a tela não gerencia outro admin),
 * então um admin já criado só é reencontrado tentando o login com a senha
 * padrão e lendo o próprio id em `/auth/me`.
 */
async function findExistingUser(http, spec) {
  const listed = await findUserByEmail(http, spec.email);
  if (listed) return listed;
  if (spec.role !== 'admin') return null;
  try {
    const session = await loginAs({ email: spec.email, password: DEFAULT_PASSWORD, label: 'probe' });
    const me = await session.request('get', '/auth/me');
    return me.data?.id ? { id: me.data.id, email: me.data.email } : null;
  } catch {
    return null;
  }
}

async function ensureUser(http, spec, logger) {
  const existing = await findExistingUser(http, spec);
  const desired = {
    name: spec.name,
    role: spec.role,
    active: spec.active,
    completed: spec.completed,
    commonUser: spec.commonUser,
    password: DEFAULT_PASSWORD,
  };

  if (existing) {
    // Repõe a senha e o estado: uma rodada anterior pode ter trocado a senha
    // (cenário de /profile/password) ou desativado a conta.
    const res = await http.request('put', `/users/${existing.id}`, { data: desired });
    logger?.info(`[role-users] reutilizado ${spec.role} ${spec.email}`);
    return res.data;
  }

  const res = await http.request('post', '/users', {
    data: { ...desired, email: spec.email, phone: randomPhone() },
  });
  logger?.info(`[role-users] criado ${spec.role} ${spec.email}`);
  return res.data;
}

/**
 * Garante todos os usuários de `ROLE_USERS` e devolve
 * `{ users: { key: user }, credentials: { key: { email, password } } }`.
 */
async function ensureRoleUsers({ http, logger }) {
  const users = {};
  const credentials = {};
  for (const spec of Object.values(ROLE_USERS)) {
    try {
      users[spec.key] = await ensureUser(http, spec, logger);
      credentials[spec.key] = { email: spec.email, password: DEFAULT_PASSWORD, role: spec.role, active: spec.active };
    } catch (e) {
      logger?.error(`[role-users] falha ao garantir ${spec.key}: ${errorMessage(e)}`);
    }
  }
  return { users, credentials };
}

/**
 * Abre um cliente logado por papel: `{ admin, coordinator, teacher, ... , anonymous }`.
 * Contas inativas não logam (a API responde sem token); ficam de fora.
 */
async function loginRoleClients({ credentials, logger, baseHttp }) {
  const clients = { anonymous: baseHttp.anonymous() };
  for (const [key, cred] of Object.entries(credentials)) {
    if (!cred.active) continue;
    try {
      clients[key] = await loginAs({ email: cred.email, password: cred.password, label: key });
    } catch (e) {
      logger?.error(`[role-users] login falhou para ${key}: ${errorMessage(e)} (status=${errorStatus(e) ?? 'n/a'})`);
    }
  }
  return clients;
}

/**
 * Garante que `ctx.as` exista com os clientes por papel. Os módulos chamam
 * isto no início para funcionarem também quando rodados isoladamente.
 */
async function ensureRoleClients({ http, logger, ctx }) {
  if (ctx.as?.admin && ctx.as?.coordinator && ctx.as?.teacher) return ctx.as;
  const { users, credentials } = await ensureRoleUsers({ http, logger });
  ctx.roleUsers = users;
  ctx.roleCredentials = credentials;
  ctx.as = await loginRoleClients({ credentials, logger, baseHttp: http });
  ctx.as.superuser = http;
  return ctx.as;
}

/** Perfil de professor/coordenador ligado a um usuário (via listagens). */
async function findTeacherProfileByUserId(http, userId) {
  const res = await http.request('get', '/teacher-profiles', { params: { page: 1, limit: 100, searchString: '' } });
  const direct = (res.data?.items ?? []).find((t) => t.user?.id === userId);
  if (direct) return direct;
  const { fetchAllPages } = require('./pagination');
  const all = await fetchAllPages(http.request, 'get', '/teacher-profiles', {}, { limit: 100, maxPages: 200 });
  return all.find((t) => t.user?.id === userId) ?? null;
}

async function findCoordinatorProfileByUserId(http, userId) {
  const { fetchAllPages } = require('./pagination');
  const all = await fetchAllPages(http.request, 'get', '/coordinator-profiles', {}, { limit: 100, maxPages: 200 });
  return all.find((c) => c.user?.id === userId) ?? null;
}

module.exports = {
  ensureRoleUsers,
  loginRoleClients,
  ensureRoleClients,
  findUserByEmail,
  findTeacherProfileByUserId,
  findCoordinatorProfileByUserId,
};
