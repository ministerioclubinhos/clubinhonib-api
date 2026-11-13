export const FEATURE_FLAGS_CACHE_TTL = 60000;

/**
 * Sufixo da chave de cache da leitura sem perfil.
 *
 * O cache guarda `chave:perfil`, e `isSwitchedOn` não tem perfil. Um escopo
 * próprio evita que a resposta sem recorte responda no lugar da resposta de
 * alguém que não fez login, e vice-versa.
 */
export const SWITCH_CACHE_SCOPE = '__switch__';

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
  /**
   * Nome antigo do resumo semanal, de antes de a chave descrever o conteúdo em
   * vez do perfil que recebe. A chave que vale é `email_weekly_club_summary`;
   * nenhum código lê esta, e ela só aparecia no painel como um interruptor que
   * não fazia nada.
   */
  'email_coordinator_weekly_summary',
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
    key: 'idea_ai_enhancement',
    name: 'Melhoria das ideias por IA',
    description:
      'Liga todo o fluxo de IA das ideias: melhoria automática no envio, pedidos e regenerações da coordenação e o processamento da fila. Desligada, nada é enviado à IA; resultados já gerados continuam na revisão e podem ser publicados.',
    enabled: false,
    targetRoles: [],
  },
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
    key: 'club_weekly_summary',
    name: 'Resumo Semanal dos Clubinhos',
    description:
      'Visão de semana, mês, trimestre e ano dos clubinhos do coordenador. É a tela que o resumo de segunda-feira abre.',
    enabled: true,
    /*
     * Só o coordenador. O administrador tem as Estatísticas, que cobrem a base
     * inteira com muito mais detalhe — dar a ele mais uma leitura dos mesmos
     * números, recortada por clubinho, seria uma segunda porta para o mesmo
     * lugar.
     */
    targetRoles: ['coordinator'],
  },
  {
    key: 'pagelas',
    name: 'Pagelas',
    description: 'Gestão das pagelas no painel.',
    enabled: true,
    targetRoles: ['admin', 'coordinator'],
  },
  {
    key: 'notification_center_v2',
    name: 'Central de Notificações',
    description:
      'Sininho novo com histórico, filtros e leitura em lote. Desligada, volta o sininho anterior sem perder avisos nem leituras.',
    enabled: true,
    /* Liberação controlada: começa pelos administradores. */
    targetRoles: ['admin'],
  },
  {
    key: 'notification_sound',
    name: 'Som dos avisos',
    description:
      'Oferece o toque curto para novos avisos no site. Cada pessoa liga ou desliga o som no próprio navegador.',
    enabled: false,
    targetRoles: [],
  },
  {
    key: 'browser_notifications',
    name: 'Notificações do navegador',
    description:
      'Oferece o aviso do navegador enquanto o site está aberto. Pede permissão só quando a pessoa clica.',
    enabled: false,
    targetRoles: [],
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

  /*
   * As flags dos e-mails.
   *
   * Todas nascem ligadas: a flag existe para **desligar** um envio, e semeá-la
   * desligada silenciaria de uma vez avisos que já funcionavam — inclusive a
   * recuperação de senha, no primeiro boot depois do deploy.
   *
   * `targetRoles` fica vazio de propósito. Um e-mail sai para uma lista de
   * endereços, não para uma sessão: não há perfil a comparar, e preencher a
   * lista aqui só criaria um recorte que nunca casa.
   */
  {
    key: 'email_password_recovery',
    name: 'E-mail: Recuperação de Senha',
    description:
      'Envio do link de redefinição de senha. Desligar tranca quem esqueceu a senha para fora da conta.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'email_password_changed',
    name: 'E-mail: Senha Alterada',
    description:
      'Aviso de que a senha da conta mudou. É como a pessoa descobre uma troca que não foi ela quem fez.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'email_verification',
    name: 'E-mail: Confirmação de Endereço',
    description:
      'Envio do link que confirma o e-mail e ativa o acesso. Desligar impede novos cadastros de concluírem.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'email_contact_notification',
    name: 'E-mail: Aviso de Novo Contato',
    description:
      'Aviso à coordenação quando alguém escreve pelo formulário de contato.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'email_feed_photo_comment_rejected',
    name: 'E-mail: Comentário de Foto Reprovado',
    description:
      'Avisa o autor sobre a reprovação de um comentário de foto do feed, com o motivo. Não controla o aviso no sininho.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'email_comment_notification',
    name: 'E-mail: Aviso de Novo Comentário',
    description:
      'Aviso à coordenação quando um professor posta um comentário na Área do Professor.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'email_site_feedback_notification',
    name: 'E-mail: Aviso de Nova Avaliação',
    description: 'Aviso à coordenação quando o site recebe uma avaliação.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'email_idea_shared_notification',
    name: 'E-mail: Aviso de Nova Ideia',
    description:
      'Aviso à coordenação quando uma ideia é compartilhada pelo site.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'email_image_shared_notification',
    name: 'E-mail: Aviso de Novas Imagens',
    description:
      'Aviso à coordenação quando imagens do Clubinho são compartilhadas pelo site.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'email_new_user_registration',
    name: 'E-mail: Aviso de Novo Pré-cadastro',
    description: 'Aviso à coordenação quando alguém faz pré-cadastro no site.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'email_week_material_announcement',
    name: 'E-mail: Novo Material da Semana',
    description:
      'Aviso a toda a base quando um material da semana entra no ar.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'email_event_created',
    name: 'E-mail: Novo Evento na Agenda',
    description: 'Aviso a toda a base quando um evento entra na agenda.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'email_event_updated',
    name: 'E-mail: Evento Atualizado',
    description: 'Aviso a toda a base quando um evento da agenda muda.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'email_event_cancelled',
    name: 'E-mail: Evento Cancelado',
    description: 'Aviso a toda a base quando um evento sai da agenda.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'email_address_changed',
    name: 'E-mail: Endereço de Login Trocado',
    description:
      'Aviso ao endereço ANTIGO quando o e-mail de login muda. É como a pessoa descobre uma troca que não foi ela quem fez.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'email_account_approved',
    name: 'E-mail: Cadastro Aprovado',
    description:
      'Aviso à pessoa de que o pré-cadastro dela foi liberado e o acesso já funciona.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'email_role_changed',
    name: 'E-mail: Papel Alterado',
    description:
      'Aviso à pessoa de que o papel dela mudou. Trocar de papel também desfaz o vínculo com o clubinho.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'email_account_deactivated',
    name: 'E-mail: Conta Desativada',
    description:
      'Aviso à pessoa de que o acesso foi suspenso. Reversível pela coordenação.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'email_account_deleted',
    name: 'E-mail: Conta Excluída',
    description: 'Aviso à pessoa de que a conta foi removida em definitivo.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'email_account_created',
    name: 'E-mail: Conta Criada pela Coordenação',
    description:
      'Boas-vindas com o link para a pessoa definir a própria senha.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'email_informative_published',
    name: 'E-mail: Novo Informativo',
    description: 'Aviso a toda a base quando um informativo é publicado.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'email_document_published',
    name: 'E-mail: Novo Documento',
    description:
      'Aviso a toda a base quando um documento entra na área do professor.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'email_club_day_cancelled',
    name: 'E-mail: Dia sem Clubinho',
    description:
      'Aviso a toda a base quando uma data é marcada como dia em que não haverá Clubinho.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'email_contact_receipt',
    name: 'E-mail: Confirmação de Contato',
    description:
      'Confirmação para quem escreveu pelo formulário de contato, dizendo que a mensagem chegou.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'email_missing_pagela_reminder',
    name: 'E-mail: Lembrete de Pagela Faltando',
    description:
      'Lembrete de domingo aos professores e ao coordenador do clubinho que fechou a semana com pagela faltando.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'email_weekly_club_summary',
    name: 'E-mail: Resumo Semanal do Coordenador',
    description:
      'Resumo de segunda-feira para cada coordenador, com a semana dos clubinhos sob responsabilidade dele.',
    enabled: true,
    targetRoles: [],
  },
  {
    key: 'email_accepted_christ',
    name: 'E-mail: Decisão por Cristo Registrada',
    description:
      'Aviso ao coordenador e aos professores do clubinho quando a decisão de uma criança é registrada.',
    enabled: true,
    targetRoles: [],
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
