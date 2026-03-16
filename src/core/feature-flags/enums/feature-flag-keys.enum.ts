/**
 * Enum com as chaves de Feature Flags do sistema
 * Cada flag representa um módulo completo do sistema
 */
export enum FeatureFlagKeys {
  // ========================================
  // CORE - Módulos centrais
  // ========================================
  AUTH = 'auth',
  USERS = 'users',
  PROFILE = 'profile',

  // ========================================
  // CRIANÇAS E GESTÃO
  // ========================================
  CHILDREN = 'children',
  ACCEPTED_CHRISTS = 'accepted-christs',

  // ========================================
  // PAGELAS
  // ========================================
  PAGELAS = 'pagelas',

  // ========================================
  // CLUBINHOS
  // ========================================
  CLUBS = 'clubs',
  CLUB_CONTROL = 'club-control',

  // ========================================
  // ESTATÍSTICAS
  // ========================================
  STATISTICS = 'statistics',

  // ========================================
  // PERFIS DE EQUIPE
  // ========================================
  TEACHER_PROFILES = 'teacher-profiles',
  COORDINATOR_PROFILES = 'coordinator-profiles',

  // ========================================
  // CONTEÚDO E PÁGINAS
  // ========================================
  WEEK_MATERIAL = 'week-material',
  VIDEO_PAGES = 'video-pages',
  IMAGE_PAGES = 'image-pages',
  IDEAS_PAGES = 'ideas-pages',
  IMAGE_SECTIONS = 'image-sections',
  IDEAS_SECTIONS = 'ideas-sections',

  // ========================================
  // EVENTOS E ATIVIDADES
  // ========================================
  EVENTS = 'events',
  MEDITATIONS = 'meditations',

  // ========================================
  // COMUNICAÇÃO
  // ========================================
  INFORMATIVES = 'informatives',
  CONTACTS = 'contacts',
  COMMENTS = 'comments',
  FEEDBACKS = 'feedbacks',

  // ========================================
  // ARQUIVOS E MÍDIA
  // ========================================
  DOCUMENTS = 'documents',
  MEDIA = 'media',

  // ========================================
  // ROTAS E NAVEGAÇÃO
  // ========================================
  ROUTES = 'routes',

  // ========================================
  // NOTIFICAÇÕES
  // ========================================
  NOTIFICATIONS = 'notifications',

  // ========================================
  // SISTEMA
  // ========================================
  SYSTEM_MAINTENANCE = 'system-maintenance',
  SYSTEM_REGISTRATION = 'system-registration',
  SYSTEM_API_PUBLIC = 'system-api-public',
}
