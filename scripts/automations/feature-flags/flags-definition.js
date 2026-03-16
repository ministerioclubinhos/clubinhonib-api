/**
 * Definição de Feature Flags do sistema Clubinho NIB
 * Flags por módulo geral (habilita/desabilita módulo inteiro)
 */

const MODULE_FLAGS = [
  // ========================================
  // CORE - Módulos centrais
  // ========================================
  {
    key: 'auth',
    name: 'Autenticação',
    description: 'Módulo de autenticação (login, registro, recuperação de senha)',
    enabled: true,
    category: 'core',
  },
  {
    key: 'users',
    name: 'Usuários',
    description: 'Módulo de gestão de usuários',
    enabled: true,
    category: 'core',
  },
  {
    key: 'profile',
    name: 'Perfil',
    description: 'Módulo de perfil do usuário',
    enabled: true,
    category: 'core',
  },

  // ========================================
  // CRIANÇAS E GESTÃO
  // ========================================
  {
    key: 'children',
    name: 'Crianças',
    description: 'Módulo de gestão de crianças (cadastro, listagem, edição)',
    enabled: true,
    category: 'children',
  },
  {
    key: 'accepted-christs',
    name: 'Aceitos em Cristo',
    description: 'Módulo de registro de crianças que aceitaram Cristo',
    enabled: true,
    category: 'children',
  },

  // ========================================
  // PAGELAS
  // ========================================
  {
    key: 'pagelas',
    name: 'Pagelas',
    description: 'Módulo de pagelas/figurinhas das crianças',
    enabled: true,
    category: 'pagelas',
  },

  // ========================================
  // CLUBINHOS
  // ========================================
  {
    key: 'clubs',
    name: 'Clubinhos',
    description: 'Módulo de gestão de clubinhos',
    enabled: true,
    category: 'clubs',
  },
  {
    key: 'club-control',
    name: 'Controle de Clubinhos',
    description: 'Módulo de controle e presença nos clubinhos',
    enabled: true,
    category: 'clubs',
  },

  // ========================================
  // ESTATÍSTICAS
  // ========================================
  {
    key: 'statistics',
    name: 'Estatísticas',
    description: 'Módulo de estatísticas e relatórios gerais',
    enabled: true,
    category: 'statistics',
  },

  // ========================================
  // PERFIS DE EQUIPE
  // ========================================
  {
    key: 'teacher-profiles',
    name: 'Perfis de Professores',
    description: 'Módulo de gestão de perfis de professores',
    enabled: true,
    category: 'team',
  },
  {
    key: 'coordinator-profiles',
    name: 'Perfis de Coordenadores',
    description: 'Módulo de gestão de perfis de coordenadores',
    enabled: true,
    category: 'team',
  },

  // ========================================
  // CONTEÚDO E PÁGINAS
  // ========================================
  {
    key: 'week-material',
    name: 'Material Semanal',
    description: 'Módulo de material semanal para as aulas',
    enabled: true,
    category: 'content',
  },
  {
    key: 'video-pages',
    name: 'Páginas de Vídeos',
    description: 'Módulo de páginas de vídeos',
    enabled: true,
    category: 'content',
  },
  {
    key: 'image-pages',
    name: 'Páginas de Imagens',
    description: 'Módulo de páginas de imagens',
    enabled: true,
    category: 'content',
  },
  {
    key: 'ideas-pages',
    name: 'Páginas de Ideias',
    description: 'Módulo de páginas de ideias e sugestões',
    enabled: true,
    category: 'content',
  },
  {
    key: 'image-sections',
    name: 'Seções de Imagens',
    description: 'Módulo de seções de imagens',
    enabled: true,
    category: 'content',
  },
  {
    key: 'ideas-sections',
    name: 'Seções de Ideias',
    description: 'Módulo de seções de ideias',
    enabled: true,
    category: 'content',
  },

  // ========================================
  // EVENTOS E ATIVIDADES
  // ========================================
  {
    key: 'events',
    name: 'Eventos',
    description: 'Módulo de eventos e atividades especiais',
    enabled: true,
    category: 'activities',
  },
  {
    key: 'meditations',
    name: 'Meditações',
    description: 'Módulo de meditações bíblicas',
    enabled: true,
    category: 'activities',
  },

  // ========================================
  // COMUNICAÇÃO
  // ========================================
  {
    key: 'informatives',
    name: 'Informativos',
    description: 'Módulo de informativos e comunicados',
    enabled: true,
    category: 'communication',
  },
  {
    key: 'contacts',
    name: 'Contatos',
    description: 'Módulo de contatos e mensagens',
    enabled: true,
    category: 'communication',
  },
  {
    key: 'comments',
    name: 'Comentários',
    description: 'Módulo de comentários',
    enabled: true,
    category: 'communication',
  },
  {
    key: 'feedbacks',
    name: 'Feedbacks',
    description: 'Módulo de feedbacks do site',
    enabled: true,
    category: 'communication',
  },

  // ========================================
  // ARQUIVOS E MÍDIA
  // ========================================
  {
    key: 'documents',
    name: 'Documentos',
    description: 'Módulo de documentos e arquivos',
    enabled: true,
    category: 'files',
  },
  {
    key: 'media',
    name: 'Mídia',
    description: 'Módulo de upload e gestão de mídia',
    enabled: true,
    category: 'files',
  },

  // ========================================
  // ROTAS E NAVEGAÇÃO
  // ========================================
  {
    key: 'routes',
    name: 'Rotas',
    description: 'Módulo de rotas e navegação do site',
    enabled: true,
    category: 'navigation',
  },

  // ========================================
  // NOTIFICAÇÕES
  // ========================================
  {
    key: 'notifications',
    name: 'Notificações',
    description: 'Módulo de notificações (email, SMS, push)',
    enabled: true,
    category: 'notifications',
  },

  // ========================================
  // SISTEMA
  // ========================================
  {
    key: 'system-maintenance',
    name: 'Modo Manutenção',
    description: 'Coloca o sistema em modo de manutenção',
    enabled: false,
    category: 'system',
  },
  {
    key: 'system-registration',
    name: 'Registro Aberto',
    description: 'Permite novos registros no sistema',
    enabled: true,
    category: 'system',
  },
  {
    key: 'system-api-public',
    name: 'API Pública',
    description: 'Habilita endpoints públicos da API',
    enabled: true,
    category: 'system',
  },

  // ========================================
  // SHELTER (Legado)
  // ========================================
  {
    key: 'shelter-address',
    name: 'Shelter Address',
    description: 'Funcionalidade shelter de endereços',
    enabled: false,
    category: 'shelter',
  },
  {
    key: 'shelter-management',
    name: 'Shelter Management',
    description: 'Funcionalidade shelter de gerenciamento',
    enabled: false,
    category: 'shelter',
  },
  {
    key: 'shelter-pagelas',
    name: 'Shelter Pagelas',
    description: 'Funcionalidade shelter de pagelas',
    enabled: false,
    category: 'shelter',
  },
];

/**
 * Retorna todas as flags
 */
function getAllFlags() {
  return MODULE_FLAGS.map((flag) => ({
    ...flag,
    metadata: { category: flag.category },
  }));
}

/**
 * Retorna flags por categoria
 */
function getFlagsByCategory(category) {
  return MODULE_FLAGS.filter((f) => f.category === category);
}

/**
 * Retorna lista de categorias disponíveis
 */
function getCategories() {
  return [...new Set(MODULE_FLAGS.map((f) => f.category))];
}

/**
 * Conta total de flags
 */
function getTotalFlagsCount() {
  return MODULE_FLAGS.length;
}

/**
 * Retorna uma flag específica por key
 */
function getFlagByKey(key) {
  return MODULE_FLAGS.find((f) => f.key === key);
}

module.exports = {
  MODULE_FLAGS,
  getAllFlags,
  getFlagsByCategory,
  getCategories,
  getTotalFlagsCount,
  getFlagByKey,
};
