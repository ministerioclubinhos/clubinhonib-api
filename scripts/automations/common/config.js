const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const SUPERUSER_EMAIL = process.env.SUPERUSER_EMAIL || 'superuser@clubinhonib.com';
const SUPERUSER_PASSWORD = process.env.SUPERUSER_PASSWORD || 'Abc@123';

const ACADEMIC_YEAR = Number(process.env.ACADEMIC_YEAR || 2025);

module.exports = {
  API_BASE_URL,
  SUPERUSER_EMAIL,
  SUPERUSER_PASSWORD,
  ACADEMIC_YEAR,
  // Defaults de automação (podem ser sobrescritos via ENV)
  USERS_TO_CREATE: Number(process.env.USERS_TO_CREATE || 20),
  MIN_CLUBS: Number(process.env.MIN_CLUBS || 10),
  MIN_TEACHERS_PER_CLUB: Number(process.env.MIN_TEACHERS_PER_CLUB || 10),
  CHILDREN_PER_CLUB: Number(process.env.CHILDREN_PER_CLUB || 10),
  // WEEKS:
  // - se não setar ENV, usamos 0 => "auto" (calcula pelo período letivo)
  // - se setar ENV WEEKS=48, força 48
  WEEKS: process.env.WEEKS ? Number(process.env.WEEKS) : 0,

  // Conteúdo / páginas
  MIN_PAGES_ITEMS: Number(process.env.MIN_PAGES_ITEMS || 10),

  // Pagelas knobs
  PAGELAS_CHILD_LIMIT: Number(process.env.PAGELAS_CHILD_LIMIT || 0), // 0 = all
  PAGELAS_DEBUG: process.env.PAGELAS_DEBUG === '1' || process.env.PAGELAS_DEBUG === 'true',
  PAGELAS_CHILD_ID: process.env.PAGELAS_CHILD_ID || '',
};


