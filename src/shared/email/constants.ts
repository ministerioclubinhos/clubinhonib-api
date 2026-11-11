import { FeatureFlagKeys } from 'src/core/feature-flags/enums/feature-flag-keys.enum';

import { EmailNotification } from './types';

/**
 * Paleta da marca usada por todos os e-mails.
 *
 * São as quatro cores do logo do Clubinho Bíblico para Crianças: o verde é a
 * principal, e azul royal, vermelho e amarelo são as secundárias.
 *
 * Cada uma tem **um** papel, e não sai dele: o azul é a faixa do cabeçalho e o
 * texto do corpo, o verde fecha essa faixa e pinta o botão, o amarelo marca a
 * citação e o vermelho fica reservado ao aviso que a pessoa não pode deixar
 * passar. Gasta em qualquer lugar, uma cor de marca deixa de significar algo.
 * Rótulos e separadores usam os tons neutros.
 */
export const EMAIL_COLORS = {
  /** Principal, o verde do logo: fecha o cabeçalho e pinta o botão. */
  brandGreen: '#55FF58',
  /** Secundária, o azul royal do logo: faixa do cabeçalho e cor do texto. */
  brandBlue: '#30328B',
  /** Secundária, o vermelho do logo: reservado ao bloco de aviso. */
  brandRed: '#ED1B24',
  /** Secundária, o amarelo do logo: filete da citação. */
  brandYellow: '#FFDC04',

  bodyBackground: '#F4F6F8',
  cardBackground: '#FFFFFF',
  /** Faixa do cabeçalho, escura nos dois temas. */
  headerBackground: '#30328B',
  /** Texto do corpo, no azul royal da marca. */
  primaryText: '#30328B',
  /** Rótulos e textos de apoio. */
  mutedText: '#6B7280',
  /** Separadores e contornos discretos. */
  border: '#E6E8EC',
  /** Fundo dos blocos destacados. */
  surface: '#F7F8FA',
  /** Texto sobre a faixa escura do cabeçalho. */
  onDark: '#FFFFFF',
  /** Fundo do botão de ação, no verde principal. */
  buttonBackground: '#55FF58',
  /** Texto do botão: azul da marca, já que o verde é claro demais para branco. */
  buttonText: '#30328B',
  /** Fundo do bloco de aviso, o vermelho da marca bem diluído. */
  alertBackground: '#FEF2F2',
} as const;

/**
 * A pilha que substitui a fonte display do logo quando ela não carrega.
 *
 * O nome da marca sai na Lilita One, a display arredondada mais próxima do
 * logo, pedida por `<link>` no cabeçalho. Gmail e Outlook ignoram fonte
 * externa, então a pilha abaixo é o que a maioria vê de fato: uma sem-serifa
 * pesada, nunca a serifa padrão do cliente.
 */
export const EMAIL_DISPLAY_FALLBACK =
  "'Trebuchet MS', 'Segoe UI', Verdana, Helvetica, Arial, sans-serif";

/** Textos fixos do cabeçalho e do rodapé. */
export const EMAIL_BRAND = {
  name: 'Clubinhos NIB',
  tagline: 'Conectando Crianças através da fé',
} as const;

/** Assunto de cada e-mail, em um lugar só. */
export const EMAIL_SUBJECTS = {
  feedPhotoCommentRejected:
    'Seu comentário no feed foi reprovado - Clubinhos NIB',
  passwordRecovery: 'Recuperação de senha - Clubinhos NIB',
  passwordChanged: 'Senha alterada com sucesso - Clubinhos NIB',
  emailVerification: 'Confirme seu e-mail - Clubinhos NIB',
  contactNotification: 'Novo contato pelo site',
  commentNotification: 'Novo comentário enviado na Área do Professor',
  siteFeedbackNotification: 'Nova avaliação do site',
  ideaSharedNotification: 'Nova ideia compartilhada pelo site',
  imageSharedNotification: 'Novas imagens compartilhadas do Clubinho',
  newUserRegistrationNotification: 'Novo pré-cadastro de usuário no site',
  weekMaterialAnnouncement: 'Novo material da semana já disponível',
  specialMaterialAnnouncement: 'Novo material especial já disponível',
  eventCreated: 'Novo evento na agenda do Clubinho',
  eventUpdated: 'Um evento da agenda mudou',
  eventCancelled: 'Um evento saiu da agenda',
  emailAddressChanged: 'Seu e-mail de acesso foi alterado - Clubinhos NIB',
  accountApproved: 'Seu cadastro foi aprovado - Clubinhos NIB',
  roleChanged: 'Seu papel na plataforma mudou - Clubinhos NIB',
  accountDeactivated: 'Seu acesso foi suspenso - Clubinhos NIB',
  accountDeleted: 'Sua conta foi encerrada - Clubinhos NIB',
  accountCreatedByAdmin: 'Sua conta no Clubinho está pronta',
  informativePublished: 'Novo informativo do Clubinho',
  documentPublished: 'Novo documento na Área do Professor',
  clubDayCancelled: 'Neste dia não vai ter Clubinho',
  contactReceipt: 'Recebemos sua mensagem - Clubinhos NIB',
  missingPagelaReminder: 'Pagelas pendentes da semana',
  coordinatorWeeklySummary: 'Resumo da semana dos seus clubinhos',
  acceptedChristRegistered: 'Uma criança tomou uma decisão',
} as const;

/**
 * A feature flag de cada e-mail.
 *
 * Uma flag por notificação, nunca uma compartilhada: desligar o formulário de
 * contato e parar de avisar a equipe sobre os contatos que já chegaram são
 * decisões diferentes.
 *
 * O `satisfies` é o que fecha a regra — um valor novo em `EmailNotification`
 * sem a flag correspondente não compila.
 */
export const EMAIL_NOTIFICATION_FLAGS = {
  [EmailNotification.FeedPhotoCommentRejected]:
    FeatureFlagKeys.EMAIL_FEED_PHOTO_COMMENT_REJECTED,
  [EmailNotification.PasswordRecovery]: FeatureFlagKeys.EMAIL_PASSWORD_RECOVERY,
  [EmailNotification.PasswordChanged]: FeatureFlagKeys.EMAIL_PASSWORD_CHANGED,
  [EmailNotification.EmailVerification]: FeatureFlagKeys.EMAIL_VERIFICATION,
  [EmailNotification.ContactNotification]:
    FeatureFlagKeys.EMAIL_CONTACT_NOTIFICATION,
  [EmailNotification.CommentNotification]:
    FeatureFlagKeys.EMAIL_COMMENT_NOTIFICATION,
  [EmailNotification.SiteFeedbackNotification]:
    FeatureFlagKeys.EMAIL_SITE_FEEDBACK_NOTIFICATION,
  [EmailNotification.IdeaSharedNotification]:
    FeatureFlagKeys.EMAIL_IDEA_SHARED_NOTIFICATION,
  [EmailNotification.ImageSharedNotification]:
    FeatureFlagKeys.EMAIL_IMAGE_SHARED_NOTIFICATION,
  [EmailNotification.NewUserRegistrationNotification]:
    FeatureFlagKeys.EMAIL_NEW_USER_REGISTRATION,
  [EmailNotification.WeekMaterialAnnouncement]:
    FeatureFlagKeys.EMAIL_WEEK_MATERIAL_ANNOUNCEMENT,
  [EmailNotification.EventCreated]: FeatureFlagKeys.EMAIL_EVENT_CREATED,
  [EmailNotification.EventUpdated]: FeatureFlagKeys.EMAIL_EVENT_UPDATED,
  [EmailNotification.EventCancelled]: FeatureFlagKeys.EMAIL_EVENT_CANCELLED,
  [EmailNotification.EmailAddressChanged]:
    FeatureFlagKeys.EMAIL_ADDRESS_CHANGED,
  [EmailNotification.AccountApproved]: FeatureFlagKeys.EMAIL_ACCOUNT_APPROVED,
  [EmailNotification.RoleChanged]: FeatureFlagKeys.EMAIL_ROLE_CHANGED,
  [EmailNotification.AccountDeactivated]:
    FeatureFlagKeys.EMAIL_ACCOUNT_DEACTIVATED,
  [EmailNotification.AccountDeleted]: FeatureFlagKeys.EMAIL_ACCOUNT_DELETED,
  [EmailNotification.AccountCreatedByAdmin]:
    FeatureFlagKeys.EMAIL_ACCOUNT_CREATED,
  [EmailNotification.InformativePublished]:
    FeatureFlagKeys.EMAIL_INFORMATIVE_PUBLISHED,
  [EmailNotification.DocumentPublished]:
    FeatureFlagKeys.EMAIL_DOCUMENT_PUBLISHED,
  [EmailNotification.ClubDayCancelled]:
    FeatureFlagKeys.EMAIL_CLUB_DAY_CANCELLED,
  [EmailNotification.ContactReceipt]: FeatureFlagKeys.EMAIL_CONTACT_RECEIPT,
  [EmailNotification.MissingPagelaReminder]:
    FeatureFlagKeys.EMAIL_MISSING_PAGELA_REMINDER,
  [EmailNotification.CoordinatorWeeklySummary]:
    FeatureFlagKeys.EMAIL_WEEKLY_CLUB_SUMMARY,
  [EmailNotification.AcceptedChristRegistered]:
    FeatureFlagKeys.EMAIL_ACCEPTED_CHRIST,
} as const satisfies Record<EmailNotification, FeatureFlagKeys>;

/**
 * O que vale quando a flag não está no banco: enviar.
 *
 * A carga de flags do boot engole a própria falha para não impedir a API de
 * subir. Se ela falhar e a ausência significasse "não enviar", um deploy
 * silenciaria todos os e-mails de uma vez — inclusive a recuperação de senha,
 * trancando as pessoas para fora da conta sem ninguém ter desligado nada.
 *
 * A flag existe para **desligar** um envio, e desligar é um ato deliberado.
 */
export const EMAIL_SEND_WHEN_FLAG_MISSING = true;

/** Validade dos links enviados, em minutos. */
export const EMAIL_LINK_TTL_MINUTES = {
  passwordRecovery: 30,
  emailVerification: 60 * 24,
} as const;

/** Largura máxima do cartão, o padrão seguro para clientes de e-mail. */
export const EMAIL_MAX_WIDTH_PX = 600;

/**
 * Quantos endereços entram em cada envio de um aviso para toda a base.
 *
 * O aviso vai por cópia oculta em lotes: o Gmail limita destinatários por
 * mensagem e por dia, e um lote menor também reduz o estrago quando um envio
 * falha no meio.
 */
export const EMAIL_ANNOUNCEMENT_BATCH_SIZE = 50;

/** Esquemas aceitos em um link dentro do e-mail. */
export const EMAIL_ALLOWED_URL_SCHEMES = ['http:', 'https:'] as const;

/** Separa o id da assinatura no token de descadastro. */
export const UNSUBSCRIBE_TOKEN_SEPARATOR = '.';

/** Caminho, no site, da página que confirma o descadastro. */
export const UNSUBSCRIBE_PATH = '/descadastrar';

/** Textos do rodapé de descadastro, em um lugar só. */
export const UNSUBSCRIBE_FOOTER = {
  question: 'Não quer mais receber os avisos do Clubinho?',
  action: 'Cancelar o recebimento',
} as const;

/**
 * As notificações que saem mesmo para conta inativa.
 *
 * A regra geral é o contrário: aviso só vai para quem está ativo. Estas são a
 * exceção porque cortá-las trancaria a pessoa para fora da própria conta, ou
 * porque o destinatário nem é um usuário da base.
 *
 * É a mesma lógica do descadastro — quem sai da lista de avisos continua
 * recebendo o que responde a algo que ele mesmo pediu.
 *
 * | Notificação | Por que é exceção |
 * | --- | --- |
 * | `EmailVerification` | A conta nasce inativa; é este e-mail que a ativa |
 * | `AccountCreatedByAdmin` | A conta foi criada pelo admin e ainda não foi confirmada |
 * | `PasswordRecovery` | Sem ela, quem não confirmou o e-mail não recupera a senha |
 * | `PasswordChanged` | Aviso de segurança sobre a conta da pessoa |
 * | `EmailAddressChanged` | Vai para o endereço **anterior**, que já não é da conta |
 * | `AccountDeactivated` | A conta acabou de ficar inativa; o aviso é sobre isso |
 * | `AccountDeleted` | A linha do usuário não existe mais |
 * | `ContactReceipt` | Quem escreveu pelo site não está na base |
 */
export const EMAIL_NOTIFICATIONS_FOR_INACTIVE: ReadonlySet<EmailNotification> =
  new Set([
    EmailNotification.EmailVerification,
    EmailNotification.AccountCreatedByAdmin,
    EmailNotification.PasswordRecovery,
    EmailNotification.PasswordChanged,
    EmailNotification.EmailAddressChanged,
    EmailNotification.AccountDeactivated,
    EmailNotification.AccountDeleted,
    EmailNotification.ContactReceipt,
  ]);
