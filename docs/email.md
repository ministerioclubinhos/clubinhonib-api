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

Contato, avaliação do site e conteúdo compartilhado avisam **os administradores
cadastrados** (`UserRepository.findAdminEmails`), não uma lista fixa em variável
de ambiente. Vão no `to`, não em cópia oculta: é um grupo pequeno e interno, e
todos verem quem mais recebeu ajuda a combinar quem responde.

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
