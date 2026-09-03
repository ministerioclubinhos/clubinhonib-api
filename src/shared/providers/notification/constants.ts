/**
 * Telas do painel para onde os avisos internos apontam.
 *
 * Ficam aqui, e não soltas nos templates, para o link do e-mail e a rota do
 * site não divergirem quando uma das duas mudar.
 */
export const ADMIN_PANEL_PATHS = {
  feedbacks: 'adm/feedbacks',
  comments: 'adm/comentarios',
  contacts: 'adm/contatos',
} as const;
