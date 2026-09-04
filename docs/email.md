# E-mail

Todo e-mail da API sai por **SMTP do Gmail**. A AWS SES foi removida: além de
custar uma dependência a mais, a verificação de endereço usada por ela era o
mecanismo de sandbox do próprio SES e nunca informava a aplicação.

## Estrutura

```text
src/shared/providers/smtp/       # a integração: só isto fala com o servidor
├── smtp.service.ts              # transporte nodemailer, sendMail()
├── smtp.constants.ts
└── smtp.types.ts                # MailMessage

src/shared/email/                # o domínio: assunto, conteúdo e destinatários
├── email.service.ts             # um método por e-mail; único ponto de disparo
├── constants.ts                 # cores, marca, assuntos, prazos
├── types.ts                     # EmailContent e os dados de cada e-mail
├── utils.ts                     # escapeHtml, safeUrl, formatação
└── templates/
    ├── layout.ts                # a casca usada por todos
    ├── blocks.ts                # parágrafo, botão, tabela, citação...
    └── *.template.ts            # um arquivo por e-mail
```

Um caso de uso nunca monta assunto nem HTML: chama um método do `EmailService`.

## A casca e os blocos

`renderEmailLayout({ title, recipientName?, body })` devolve o e-mail inteiro —
cabeçalho verde da marca, cartão central de 600px, rodapé — e é a única peça que
conhece o HTML da moldura. O miolo é montado com os blocos de `blocks.ts`
(`paragraph`, `heading`, `button`, `linkFallback`, `note`, `dataTable`,
`quoteBlock`) e juntado por `composeBody`.

O verde e o vermelho são cores de marca fortes: entram como **acento** — faixa
do topo, filete da citação, fundo do botão — nunca como contorno de cada campo.
Rótulos e separadores usam os tons neutros (`mutedText`, `border`, `surface`).

Regras que a casca garante:

- **tudo escapado**: os blocos passam cada texto por `escapeHtml`. Nenhum
  template interpola dado cru — o formulário de contato é público, e antes quem
  o preenchia escolhia o HTML que a equipe abria na caixa de entrada;
- **link só http(s)**: `button` e `linkFallback` usam `safeUrl` e simplesmente
  não renderizam o link quando o esquema é outro;
- **sempre com versão texto**: todo template devolve `EmailContent`
  (`subject`, `html`, `text`). Clientes sem HTML e filtros de spam leem o texto;
- **tema escuro e mobile** resolvidos uma vez só, nas media queries da casca.

## E-mails existentes

| E-mail | Disparo | Template |
|---|---|---|
| Recuperação de senha | `POST /auth/forgot-password` | `password-recovery.template.ts` |
| Senha alterada | `POST /auth/reset-password` | `password-changed.template.ts` |
| Confirmação de e-mail | registro, login de conta inativa, `POST /auth/resend-verification` | `email-verification.template.ts` |
| Aviso de novo contato | `POST /contact` | `contact-notification.template.ts` |
| Nova avaliação do site | `POST /site-feedbacks` | `site-feedback-notification.template.ts` |
| Novo material da semana | `POST /week-material-pages` | `week-material-announcement.template.ts` |
| Evento criado, alterado ou cancelado | `POST`, `PUT` e `DELETE` de `/events` | `event-announcement.template.ts` |

## Descadastro

Todo e-mail endereçado a uma pessoa da base leva, no rodapé, um link que cancela
o recebimento dos avisos. Fica discreto de propósito — 11px, no tom neutro, sob
o direito autoral — mas está sempre ao alcance.

### O que para e o que continua

Descadastrar interrompe **os avisos**: novo material da semana e eventos da
agenda. Recuperação de senha, confirmação de e-mail e aviso de senha alterada
continuam saindo — são resposta a algo que a pessoa acabou de pedir, e cortá-los
a trancaria para fora da própria conta. O link aparece nos dois grupos; o texto
da página de confirmação diz exatamente isso.

Os avisos internos para a equipe — contato, avaliação, comentário, ideia,
imagem, pré-cadastro — não levam o link: vão para uma lista de endereços de
administradores, não para uma pessoa identificada, e não há assinatura a emitir
nem lista da qual sair.

### O token

`UnsubscribeTokenService` emite `<userId>.<hmac>`, um HMAC-SHA256 do id com o
segredo do servidor. Não é JWT de propósito:

- **não expira** — o link vive dentro de um e-mail que pode ser aberto meses
  depois;
- **não abre nada** — assinado com `EMAIL_UNSUBSCRIBE_SECRET` (ou, na falta
  dela, `JWT_SECRET`), serve só para esta operação e não vale como sessão;
- **nada é guardado** — o token se valida sozinho, sem tabela de tokens.

A verificação compara em tempo constante: `===` vazaria, pelo tempo de resposta,
o quanto de uma assinatura forjada estava certo.

### Por que `POST`, e não `GET`

O link do rodapé aponta para `/descadastrar` **no site**, não para a API. A
página pede a confirmação e só então chama `POST /email-preferences/unsubscribe`.

Um `GET` que já cancelasse seria disparado pelos leitores de link que os
provedores rodam antes de a pessoa abrir a mensagem — e descadastraria quem
nunca clicou.

A rota é pública: quem clica no link de um e-mail antigo não está logado. Quem
autoriza é o token. A operação é idempotente, e a resposta é a mesma para token
inválido e para usuário inexistente — não conta se aquele endereço está na base.

### Um envio por pessoa

Os avisos saíam em lotes com os endereços em cópia oculta: um HTML para muita
gente. O rodapé precisa levar o token de quem recebe, e um token só serve para
uma pessoa — então cada mensagem passou a ser montada para o seu destinatário.

`BulkEmailResult` conta mensagens (`sent`/`failed`), não mais lotes. Uma falha
isolada não interrompe as demais.

> **Atenção operacional**: agora são N envios por aviso, e o SMTP do Gmail tem
> teto diário (500 em conta comum, 2000 no Workspace). Com a base grande, um
> aviso pode encostar no limite; o registro do serviço diz quantos passaram e
> quantos falharam.

`findActiveRecipients()` já devolve `EmailRecipient` (`id`, `name`, `email`) e
deixa de fora quem se descadastrou.

### Avisos internos

Os avisos para os administradores — contato, avaliação, comentário, ideia,
imagem, pré-cadastro — têm todos a mesma forma: uma tabela de dados e, quando
existe, blocos de texto. Eles são montados por `internalNoticeEmail`, que gera
**o HTML e a versão em texto a partir da mesma declaração de linhas**.

Antes cada template escrevia as duas versões à mão e elas já tinham divergido na
ordem dos campos. Linha sem valor e bloco sem texto não aparecem, então um campo
opcional não precisa de `if` no template:

```ts
return internalNoticeEmail({
  subject: EMAIL_SUBJECTS.ideaSharedNotification,
  title: 'Nova ideia compartilhada',
  intro: 'Uma nova ideia foi compartilhada no site.',
  detailsHeading: 'Detalhes da ideia',
  rows: [
    { label: 'Título', value: data.title },
    { label: 'Autor', value: data.authorName ?? '' },   // some se vazio
    { label: 'Data', value: formatBrazilianDateTime(data.sharedAt) },
  ],
  sections: [{ heading: 'Descrição', text: data.description }],
});
```

Para acrescentar um e-mail: um arquivo em `templates/`, o assunto em
`EMAIL_SUBJECTS`, os dados em `types.ts` e um método no `EmailService`.

### Conferir o layout

`npm run email:preview` gera `email-preview.html` com **todos** os modelos
renderizados lado a lado, HTML e texto puro, sem disparar nada.
Variações do mesmo aviso — os três da agenda, por exemplo — ficam no mesmo
arquivo, montando o conteúdo comum uma vez só.

## Confirmação de e-mail

Substitui o `VerifyEmailIdentity` do SES, que cadastrava o endereço na conta AWS
e nunca avisava o app: a conta ficava inativa esperando ativação manual.

1. registro, login de conta inativa ou pedido explícito chamam
   `EmailVerificationService.sendIfPending(user)`;
2. o serviço sorteia um token, **grava só o hash SHA-256** e manda o valor
   original apenas no link;
3. `POST /auth/verify-email` com o token ativa a conta (`user.active = true`) e
   apaga os tokens do usuário.

Detalhes: conta já ativa não recebe nada; um envio recente não é repetido antes
de `EMAIL_VERIFICATION_RESEND_COOLDOWN_MINUTES`, para que cada tentativa de
login não vire um e-mail; o link vale
`EMAIL_VERIFICATION_TTL_HOURS` horas.

## Avisos internos

Contato, avaliação do site, comentário e conteúdo compartilhado avisam **os
administradores cadastrados** (`UserRepository.findAdminEmails`), não uma lista
fixa em variável de ambiente. Vão no `to`, não em cópia oculta: é um grupo
pequeno e interno, e todos verem quem mais recebeu ajuda a combinar quem
responde.

### As três entradas do site

Toda mensagem que chega pelo site avisa os administradores no momento em que é
gravada:

| Entrada | Serviço | Aviso |
| --- | --- | --- |
| `POST /contact` | `CreateContactService` | `notifyNewContact` — e-mail **e** WhatsApp |
| `POST /site-feedbacks` | `CreateFeedbackService` | `notifyNewSiteFeedback` |
| `POST /comments` | `CreateCommentService` | `notifyNewComment` |

O aviso de comentário existia e **nunca era chamado**: postar um comentário não
avisava ninguém, e ele ficava parado no painel esperando publicação. Cada um dos
três serviços tem hoje um teste que exige a chamada, e que ela venha **depois**
de salvar.

### O botão do aviso

Cada aviso interno termina com um botão para a tela onde o item se resolve —
`adm/contatos`, `adm/feedbacks`, `adm/comentarios` — montado por
`SiteUrlService` e declarado em `ADMIN_PANEL_PATHS`. O caminho fica ali, e não
solto nos templates, para o link do e-mail e a rota do site não divergirem.

Sem URL, o botão simplesmente não aparece: `internalNoticeEmail` descarta a ação
vazia como já descarta linha sem valor.

O `Reply-To` aponta para quem escreveu, quando a pessoa deixou o e-mail — no
caso da avaliação do site, o campo é opcional no formulário.

Uma falha no envio **nunca** derruba a requisição: o registro já está salvo e
continua no painel.

## Avisos para toda a base

Dois fluxos avisam **todos os usuários já validados** (`active = true`):

- **material da semana**: criar a página dispara o aviso, com o link dela;
- **agenda**: criar, editar e excluir um evento disparam avisos diferentes.
  Os encontros semanais de clubinho ficam de fora: são criados pela
  sincronização, não pelo formulário, e não disparam e-mail nenhum.
  Evento não tem página própria, então o link vai para `/eventos`. O aviso de
  exclusão usa os dados lidos **antes** de remover o registro.

Em todos eles:

- o envio começa **depois de gravar** e **fora da requisição**
  (`announceInBackground`): são muitos destinatários, e uma falha no e-mail não
  pode desfazer a operação;
- os endereços vão em **cópia oculta**, em lotes de
  `EMAIL_ANNOUNCEMENT_BATCH_SIZE` (50). Ninguém vê a lista dos outros, e cada
  mensagem fica dentro do limite de destinatários do provedor;
- um lote que falha não interrompe os demais; o resultado registra quantos
  passaram.

### Limite do Gmail

O Gmail tem teto diário de destinatários — na ordem de **500/dia** para conta
comum e **2.000/dia** para Workspace. Cada aviso consome um destinatário por
pessoa da base, e agora há quatro gatilhos (material novo e as três mudanças de
agenda): uma tarde de ajustes na agenda multiplica o consumo. Passando disso, o provedor recusa os envios e pode bloquear a
conta por um período.

Se a base crescer além desse teto, a saída não é aumentar o lote: é trocar o
transporte por um serviço de envio em massa (o `SmtpService` é o único ponto que
precisaria mudar) ou escalonar os envios ao longo do dia.

O destinatário é escolhido em `GetUsersService.findActiveRecipients()`. Para
restringir por papel — só professores, por exemplo — o filtro entra ali, em um
lugar só.

## Variáveis

| Variável | Para quê |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` (STARTTLS) ou `465` (TLS direto) |
| `SMTP_USER` | conta Gmail que autentica |
| `SMTP_PASSWORD` | **Senha de App** do Google; a senha da conta não funciona com 2FA |
| `MAIL_FROM_NAME` | nome exibido como remetente |
| `MAIL_FROM_ADDRESS` | endereço do remetente; o Gmail reescreve o que não for a conta autenticada ou um alias verificado dela |
| `MAIL_CONTACT_TO` | destinatários do aviso de contato, separados por vírgula |
| `SITE_BASE_URL` | base dos links enviados; sem ela vale o mapa por `ENVIRONMENT` |

Sem `SMTP_USER`/`SMTP_PASSWORD` a aplicação sobe normalmente, registra o aviso e
recusa cada envio com `EMAIL_SEND_ERROR` — em vez de fingir que enviou.

## Privacidade

Nenhum log traz endereço de e-mail: o envio é registrado pelo assunto e pela
quantidade de destinatários.
