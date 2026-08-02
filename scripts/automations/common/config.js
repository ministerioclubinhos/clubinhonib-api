const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const SUPERUSER_EMAIL = process.env.SUPERUSER_EMAIL || 'superuser@clubinhonib.com';
const SUPERUSER_PASSWORD = process.env.SUPERUSER_PASSWORD || 'Abc@123';

const ACADEMIC_YEAR = Number(process.env.ACADEMIC_YEAR || new Date().getFullYear());

module.exports = {
  API_BASE_URL,
  SUPERUSER_EMAIL,
  SUPERUSER_PASSWORD,
  ACADEMIC_YEAR,

  // Número total de usuários extras a criar (além dos criados implicitamente pelos clubes)
  USERS_TO_CREATE: Number(process.env.USERS_TO_CREATE || 20),

  // Número mínimo de clubes
  MIN_CLUBS: Number(process.env.MIN_CLUBS || 10),

  // Número mínimo de professores por clube
  MIN_TEACHERS_PER_CLUB: Number(process.env.MIN_TEACHERS_PER_CLUB || 5),

  // Número de crianças por clube
  CHILDREN_PER_CLUB: Number(process.env.CHILDREN_PER_CLUB || 15),

  // Número de semanas para gerar pagelas (0 = calcula automaticamente do período letivo)
  WEEKS: process.env.WEEKS ? Number(process.env.WEEKS) : 0,

  // Número mínimo de itens para páginas de conteúdo (comments, events, etc.)
  MIN_PAGES_ITEMS: Number(process.env.MIN_PAGES_ITEMS || 10),

  // Opções avançadas de pagelas (para debug/limitar escopo)
  PAGELAS_CHILD_LIMIT: Number(process.env.PAGELAS_CHILD_LIMIT || 0),  // 0 = sem limite
  PAGELAS_DEBUG: process.env.PAGELAS_DEBUG === '1' || process.env.PAGELAS_DEBUG === 'true',
  PAGELAS_CHILD_ID: process.env.PAGELAS_CHILD_ID || '',
};
