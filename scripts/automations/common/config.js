/**
 * Configuração das automações. Tudo pode ser sobrescrito por variável de
 * ambiente; os padrões miram a API local (`env/local.env`).
 */
const path = require('node:path');

const CURRENT_YEAR = new Date().getFullYear();

const num = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
};

const bool = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw === '1' || raw.toLowerCase() === 'true';
};

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const SUPERUSER_EMAIL = process.env.SUPERUSER_EMAIL || 'superuser@clubinhonib.com';
const SUPERUSER_PASSWORD = process.env.SUPERUSER_PASSWORD || 'Abc@123';

/** Senha padrão de todo usuário criado pela automação. */
const DEFAULT_PASSWORD = process.env.AUTOMATION_PASSWORD || 'Senha123@';

/** Domínio dos e-mails gerados; facilita achar (e apagar) o que a automação criou. */
const EMAIL_DOMAIN = process.env.AUTOMATION_EMAIL_DOMAIN || 'teste.clubinhonib.com';

/**
 * Usuários fixos, um por cenário de papel. São idempotentes: rodar de novo
 * reaproveita a conta pelo e-mail.
 */
const ROLE_USERS = {
  admin: {
    key: 'admin',
    email: `admin.automation@${EMAIL_DOMAIN}`,
    name: 'Admin Automação',
    role: 'admin',
    active: true,
    completed: true,
    commonUser: true,
  },
  coordinator: {
    key: 'coordinator',
    email: `coordinator.automation@${EMAIL_DOMAIN}`,
    name: 'Coordenador Automação',
    role: 'coordinator',
    active: true,
    completed: true,
    commonUser: true,
  },
  coordinatorNoClubs: {
    key: 'coordinatorNoClubs',
    email: `coordinator.semclube.automation@${EMAIL_DOMAIN}`,
    name: 'Coordenador Sem Clubinho',
    role: 'coordinator',
    active: true,
    completed: true,
    commonUser: true,
  },
  teacher: {
    key: 'teacher',
    email: `teacher.automation@${EMAIL_DOMAIN}`,
    name: 'Professor Automação',
    role: 'teacher',
    active: true,
    completed: true,
    commonUser: true,
  },
  teacherUnlinked: {
    key: 'teacherUnlinked',
    email: `teacher.semclube.automation@${EMAIL_DOMAIN}`,
    name: 'Professor Sem Clubinho',
    role: 'teacher',
    active: true,
    completed: true,
    commonUser: true,
  },
  teacherInactive: {
    key: 'teacherInactive',
    email: `teacher.inativo.automation@${EMAIL_DOMAIN}`,
    name: 'Professor Inativo',
    role: 'teacher',
    active: false,
    completed: true,
    commonUser: true,
  },
  googleLike: {
    key: 'googleLike',
    email: `coordinator.google.automation@${EMAIL_DOMAIN}`,
    name: 'Coordenador Conta Google',
    role: 'coordinator',
    active: true,
    completed: true,
    // Conta "do Google": sem senha própria, troca de senha não pede a atual.
    commonUser: false,
  },
};

module.exports = {
  API_BASE_URL,
  SUPERUSER_EMAIL,
  SUPERUSER_PASSWORD,
  DEFAULT_PASSWORD,
  EMAIL_DOMAIN,
  ROLE_USERS,

  /** Caminho do arquivo de ambiente lido pelo seed do superusuário. */
  ENV_FILE: process.env.ENV_FILE || path.resolve(__dirname, '../../../env/local.env'),
  /** Semeia o superusuário direto no banco quando o login falha (só local). */
  AUTO_SEED_SUPERUSER: bool('AUTO_SEED_SUPERUSER', true),

  ACADEMIC_YEAR: num('ACADEMIC_YEAR', CURRENT_YEAR),

  USERS_TO_CREATE: num('USERS_TO_CREATE', 12),
  MIN_CLUBS: num('MIN_CLUBS', 6),
  MIN_TEACHERS_PER_CLUB: num('MIN_TEACHERS_PER_CLUB', 3),
  CHILDREN_PER_CLUB: num('CHILDREN_PER_CLUB', 10),

  /** 0 = calcula pelas datas do período letivo. */
  WEEKS: num('WEEKS', 0),

  MIN_PAGES_ITEMS: num('MIN_PAGES_ITEMS', 5),

  PAGELAS_CHILD_LIMIT: num('PAGELAS_CHILD_LIMIT', 0),
  PAGELAS_DEBUG: bool('PAGELAS_DEBUG', false),
  PAGELAS_CHILD_ID: process.env.PAGELAS_CHILD_ID || '',

  /** Pausa entre requisições em lotes grandes (ms). */
  THROTTLE_MS: num('THROTTLE_MS', 5),

  /** Binário do ffmpeg para gerar vídeo/áudio; sem ele, usa os fixtures gravados. */
  FFMPEG_PATH: process.env.FFMPEG_PATH || '',
};
