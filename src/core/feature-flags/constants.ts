export const FEATURE_FLAGS_CACHE_TTL = 60000;

/**
 * Chaves aposentadas, removidas do banco no boot.
 *
 * Elas nomeavam o perfil em vez do recurso, ou duplicavam outra flag. Ficar
 * na listagem sem efeito nenhum só confundia quem administra: a mesma tela
 * aparecia com dois interruptores, e um deles não fazia nada.
 *
 * Recriar uma destas chaves no painel não adianta — o próximo boot a remove
 * de novo. É esse o ponto: elas não devem voltar.
 */
export const RETIRED_FEATURE_FLAGS = [
  'teacher_children_access',
  'coordinator_children_access',
  'teacher_photo_upload',
  'teacher_weekly_materials',
  'teacher_site_feedback',
  'teacher_share_idea',
  'admin_statistics',
  'admin_club_control',
  'admin_pagelas',
  'shelter-address',
  'shelter-management',
  'shelter-pagelas',
] as const;

/**
 * As flags de fábrica: uma por recurso.
 *
 * O perfil nunca entra no nome da chave — quem enxerga o recurso é decidido
 * por `targetRoles`. Duas flags para o mesmo recurso, uma por perfil, davam
 * dois interruptores para a mesma coisa.
 */

export const DEFAULT_FEATURE_FLAGS = [
  {
    key: 'children_area',
    name: 'Área das Crianças',
    description:
      'Consulta das crianças e das pagelas. Quem entra é definido pelos perfis desta flag.',
    enabled: false,
    targetRoles: ['admin', 'coordinator', 'teacher'],
  },
  {
    key: 'club_photo_upload',
    name: 'Envio de Fotos do Clubinho',
    description: 'Envio de fotos do clubinho para a fila de aprovação.',
    enabled: true,
    targetRoles: ['admin', 'coordinator', 'teacher'],
  },
  {
    key: 'weekly_materials',
    name: 'Materiais Semanais',
    description: 'Lista de materiais da visita semanal.',
    enabled: true,
    targetRoles: ['admin', 'coordinator', 'teacher'],
  },
  {
    key: 'site_feedback',
    name: 'Avaliação do Site',
    description: 'Formulário de avaliação do site.',
    enabled: true,
    targetRoles: ['admin', 'coordinator', 'teacher'],
  },
  {
    key: 'idea_submission',
    name: 'Envio de Ideias',
    description: 'Envio de uma ideia para a fila de revisão.',
    enabled: true,
    targetRoles: ['admin', 'coordinator', 'teacher'],
  },
  {
    key: 'ideas_sharing',
    name: 'Galeria de Ideias',
    description: 'Galeria das ideias pedagógicas já publicadas.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'events_section',
    name: 'Eventos',
    description: 'Página de eventos e os atalhos que levam até ela.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'clubinho_feed',
    name: 'Feed do Clubinho',
    description: 'Feed de fotos e destaques dos clubinhos.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'statistics',
    name: 'Estatísticas',
    description: 'Painel de métricas e análises.',
    enabled: true,
    targetRoles: ['admin'],
  },
  {
    key: 'club_control',
    name: 'Controle de Clubinhos',
    description: 'Controle operacional dos clubinhos.',
    enabled: true,
    targetRoles: ['admin'],
  },
  {
    key: 'pagelas',
    name: 'Pagelas',
    description: 'Gestão das pagelas no painel.',
    enabled: true,
    targetRoles: ['admin', 'coordinator'],
  },
  {
    key: 'special_family_day',
    name: 'Dia Especial da Família',
    description:
      'Página do Dia Especial da Família e o convite que leva até ela.',
    enabled: false,
    targetRoles: [],
  },
  {
    key: 'public_registration',
    name: 'Cadastro Aberto',
    description: 'Criação de conta pelo site.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'google_login',
    name: 'Entrar com Google',
    description: 'Login e cadastro pela conta Google.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'password_recovery',
    name: 'Recuperação de Senha',
    description: 'Pedido de recuperação e redefinição de senha.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'contact_form',
    name: 'Formulário de Contato',
    description: 'Formulário público de contato.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'home_comments',
    name: 'Depoimentos na Home',
    description: 'Depoimentos publicados na página inicial.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'public_galleries',
    name: 'Galerias de Fotos',
    description: 'Páginas públicas de galerias de fotos.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'public_videos',
    name: 'Galerias de Vídeos',
    description: 'Páginas públicas de galerias de vídeos.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'weekly_meditation',
    name: 'Meditação da Semana',
    description: 'Meditação da semana e o banner que leva até ela.',
    enabled: true,
    targetRoles: ['admin', 'coordinator', 'teacher'],
  },
  {
    key: 'documents_library',
    name: 'Documentos',
    description: 'Seção de documentos da área do professor.',
    enabled: true,
    targetRoles: ['admin', 'coordinator', 'teacher'],
  },
  {
    key: 'training_videos',
    name: 'Vídeos de Treinamento',
    description: 'Seção de vídeos de treinamento.',
    enabled: true,
    targetRoles: ['admin', 'coordinator', 'teacher'],
  },
  {
    key: 'teaching_steps',
    name: 'Passo a Passo de Ensino',
    description: 'Seção com o passo a passo da aula.',
    enabled: true,
    targetRoles: ['admin', 'coordinator', 'teacher'],
  },
  {
    key: 'verse_of_week',
    name: 'Versículo da Semana',
    description: 'Versículo da semana na área do professor.',
    enabled: true,
    targetRoles: ['admin', 'coordinator', 'teacher'],
  },
  {
    key: 'informative_banners',
    name: 'Informativos',
    description: 'Carrossel de informativos.',
    enabled: true,
    targetRoles: ['admin', 'coordinator', 'teacher'],
  },
  {
    key: 'club_link_request',
    name: 'Vincular-se a um Clubinho',
    description: 'Pedido de vínculo a um clubinho pelo próprio usuário.',
    enabled: true,
    targetRoles: ['admin', 'coordinator', 'teacher'],
  },
  {
    key: 'accepted_christs',
    name: 'Decisões por Cristo',
    description: 'Registro da decisão por Cristo de uma criança.',
    enabled: true,
    targetRoles: ['admin', 'coordinator', 'teacher'],
  },
  {
    key: 'photo_moderation',
    name: 'Aprovação de Fotos',
    description: 'Fila de revisão das fotos enviadas pelos clubinhos.',
    enabled: true,
    targetRoles: ['admin', 'coordinator'],
  },
  {
    key: 'idea_moderation',
    name: 'Revisão de Ideias',
    description: 'Fila de revisão das ideias compartilhadas.',
    enabled: true,
    targetRoles: ['admin', 'coordinator'],
  },
  {
    key: 'comment_moderation',
    name: 'Moderação de Comentários',
    description: 'Moderação dos comentários enviados ao site.',
    enabled: true,
    targetRoles: ['admin', 'coordinator'],
  },
];

/** Paginação da listagem administrativa. */
export const FEATURE_FLAGS_DEFAULT_PAGE = 1;
export const FEATURE_FLAGS_DEFAULT_LIMIT = 12;
export const FEATURE_FLAGS_MAX_LIMIT = 100;

/** Campos aceitos na ordenação, e o padrão. */
export const FEATURE_FLAG_SORT_FIELDS = [
  'name',
  'key',
  'createdAt',
  'updatedAt',
] as const;

export const FEATURE_FLAG_DEFAULT_SORT = 'name';
export const FEATURE_FLAG_DEFAULT_ORDER = 'ASC';

/** Coluna correspondente a cada campo de ordenação aceito. */
export const FEATURE_FLAG_SORT_COLUMNS = {
  name: 'flag.name',
  key: 'flag.key',
  createdAt: 'flag.createdAt',
  updatedAt: 'flag.updatedAt',
} as const satisfies Record<(typeof FEATURE_FLAG_SORT_FIELDS)[number], string>;

/** Tamanho máximo do texto de busca. */
export const FEATURE_FLAG_SEARCH_MAX_LENGTH = 200;

/**
 * As combinações de público de uma flag.
 *
 * `EVERYONE` e `ALL_ROLES` não são a mesma coisa: sem nenhum perfil alvo a
 * flag vale até para quem não fez login, enquanto os três perfis juntos
 * exigem uma sessão.
 */
export const FEATURE_FLAG_AUDIENCES = [
  'EVERYONE',
  'ADMIN',
  'COORDINATOR',
  'TEACHER',
  'ADMIN_COORDINATOR',
  'ADMIN_TEACHER',
  'COORDINATOR_TEACHER',
  'ALL_ROLES',
] as const;
