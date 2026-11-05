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

## Toda notificação fica atrás de uma feature flag

**Regra obrigatória: todo e-mail que a aplicação dispara tem uma feature flag
própria.** Não existe e-mail sem interruptor, e não existe interruptor
compartilhado entre dois e-mails.

Uma flag por notificação, e nunca a flag do recurso que a origina: desligar o
formulário de contato e parar de avisar a equipe sobre os contatos que já
chegaram são decisões diferentes, e um interruptor só não sabe distinguir as
duas.

### Onde a checagem acontece

No `EmailService`, que é o funil por onde todo e-mail passa. Os métodos públicos
não enviam direto — eles passam por `dispatch` (envio único) ou `dispatchBulk`
(envio em massa), que consultam a flag antes:

```ts
async sendPasswordRecovery(recipient, data): Promise<void> {
  await this.dispatch(EmailNotification.PasswordRecovery, async () => {
    await this.send(recipient.email, passwordRecoveryEmail({ ...data }));
  });
}
```

A checagem mora aqui, e não em cada caso de uso, porque assim a flag não depende
de quem dispara lembrar de consultá-la. Um envio em massa bloqueado devolve
`{ recipients: 0, sent: 0, failed: 0 }`: contar como enviado o que ninguém
recebeu tornaria o log de quem chamou uma ficção.

## Falha de envio nunca derruba fluxo

**`dispatch` e `dispatchBulk` não lançam.** Nenhum e-mail da aplicação é o
produto da operação que o disparou: quando a mensagem sai, a conta já foi
criada, a senha já foi trocada, o material já foi publicado. Uma falha do
provedor é registrada no log e a operação segue.

A regra é estrutural, no funil, e não em cada chamador. Antes ela não existia, e
o efeito era concreto: com o limite diário do Gmail estourado, o **login com
Google** respondia 500 (`AuthService.googleLogin` → `sendIfPending` →
`sendEmailVerification`), com a conta já criada do outro lado. E `resetPassword`
respondia erro **depois** de trocar a senha e apagar o token — quem tentasse de
novo ouvia "token inválido ou expirado", sem descobrir que a senha nova já valia.

| Caminho | Com o provedor fora |
| --- | --- |
| Envio único (`dispatch`) | Registra o erro e devolve `false` |
| Envio em massa (`dispatchBulk`) | O laço já conta por destinatário: `{ recipients: n, sent: 0, failed: n }` |
| Flag desligada | `false` / `{ 0, 0, 0 }`, sem tentar enviar |

`sendEmailVerification` é o **único** envio cujo retorno interessa a quem chama:
a tela precisa dizer ao usuário se ele deve pedir o reenvio. Os outros ignoram o
retorno, que é o comportamento certo para um aviso.

`email.service.spec.ts` percorre os métodos públicos por reflexão e verifica um
a um que nenhum lança com o provedor recusando — e reprova se um envio novo não
entrar nessa verificação.

### Como adicionar um e-mail novo

Os cinco passos são obrigatórios, e os três primeiros não compilam sem os
outros:

1. **`EmailNotification`** (`types.ts`) — um valor para a notificação;
2. **`FeatureFlagKeys`** (`core/feature-flags/enums/`) — a chave, com prefixo
   `email_`, que mantém todas juntas na listagem ordenada por chave;
3. **`EMAIL_NOTIFICATION_FLAGS`** (`constants.ts`) — o mapa de um para o outro.
   O `satisfies Record<EmailNotification, FeatureFlagKeys>` reprova o valor novo
   que ficar sem flag;
4. **`DEFAULT_FEATURE_FLAGS`** (`core/feature-flags/constants.ts`) — a flag no
   catálogo de fábrica, **`enabled: true`** e `targetRoles: []`. Sem isso o
   interruptor nunca aparece no painel;
5. **o método de envio** passa por `dispatch` ou `dispatchBulk`.

`notification-flags.spec.ts` cobra os cinco. Um método `send*` novo que não
esteja na tabela de disparo reprova, e a única forma de fazê-lo passar é
cumprir o processo acima.

### Por que ligadas, e por que `targetRoles` vazio

Toda flag de e-mail nasce **ligada**. A flag existe para desligar um envio, e
desligar é um ato deliberado; semear desligado silenciaria de uma vez avisos que
já funcionavam — inclusive a recuperação de senha, no primeiro boot depois do
deploy.

Pelo mesmo motivo, uma chave que não está no banco vale como **ligada**
(`EMAIL_SEND_WHEN_FLAG_MISSING`). A carga de flags do boot engole a própria
falha para não impedir a API de subir, então "não encontrei a flag" é um estado
possível, e ele não pode significar caixa de entrada vazia para todo mundo.

`targetRoles` fica vazio porque um e-mail sai para uma lista de endereços, não
para uma sessão: não há perfil a comparar. Por isso o gate usa
`isSwitchedOn(key, whenMissing)`, e não `isEnabled(key, role)` — este último
responderia `false` para qualquer flag com perfis alvo, e um administrador que
preenchesse `targetRoles` no painel silenciaria o envio sem nunca ter desligado
nada.

### O atraso de um minuto

O serviço de flags guarda a resposta por 60 segundos. Desligar um e-mail no
painel leva até esse tempo para valer — aceitável para um interruptor
administrativo, e é o que evita uma consulta ao banco por destinatário em um
aviso para toda a base.

## A casca e os blocos

`renderEmailLayout({ title, recipientName?, body })` devolve o e-mail inteiro —
cabeçalho azul royal com filete verde, cartão central de 600px, rodapé — e é a
única peça que conhece o HTML da moldura. O miolo é montado com
os blocos de `blocks.ts` (`paragraph`, `heading`, `button`, `linkFallback`,
`note`, `alertNote`, `dataTable`, `quoteBlock`) e juntado por `composeBody`.

A paleta é a do logo do Clubinho Bíblico para Crianças, e cada cor tem **um**
papel:

| Cor               | Hex       | Onde aparece                                 |
| ----------------- | --------- | -------------------------------------------- |
| Verde (principal) | `#55FF58` | filete do cabeçalho e fundo do botão de ação |
| Azul royal        | `#30328B` | faixa do cabeçalho e cor do texto do corpo   |
| Vermelho          | `#ED1B24` | só o bloco `alertNote`                       |
| Amarelo           | `#FFDC04` | filete da citação (`quoteBlock`)             |

Uma cor gasta em todo lugar deixa de significar algo, então nenhuma delas vira
contorno de campo: rótulos e separadores usam os tons neutros (`mutedText`,
`border`, `surface`). O botão leva rótulo em azul, e não em branco — o verde é
claro demais para carregar texto branco por cima.

O nome da marca no cabeçalho sai na Lilita One, a display arredondada mais
próxima da do logo, pedida por `<link>`. Gmail e Outlook ignoram fonte externa;
para eles vale `EMAIL_DISPLAY_FALLBACK`, uma pilha de sem-serifa pesada.

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

| E-mail                               | Disparo                                                            | Template                                         |
| ------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------ |
| Recuperação de senha                 | `POST /auth/forgot-password`                                       | `password-recovery.template.ts`                  |
| Senha alterada                       | `POST /auth/reset-password`                                        | `password-changed.template.ts`                   |
| Confirmação de e-mail                | registro, login de conta inativa, `POST /auth/resend-verification` | `email-verification.template.ts`                 |
| Aviso de novo contato                | `POST /contact`                                                    | `contact-notification.template.ts`               |
| Nova avaliação do site               | `POST /site-feedbacks`                                             | `site-feedback-notification.template.ts`         |
| Novo material da semana              | `POST /week-material-pages`                                        | `week-material-announcement.template.ts`         |
| Evento criado, alterado ou cancelado | `POST`, `PUT` e `DELETE` de `/events`                              | `event-announcement.template.ts`                 |
| Aviso de novo comentário             | `POST /comments`                                                   | `comment-notification.template.ts`               |
| Nova ideia compartilhada             | ideias do site                                                     | `idea-shared-notification.template.ts`           |
| Novas imagens compartilhadas         | imagens do site                                                    | `image-shared-notification.template.ts`          |
| Novo pré-cadastro                    | registro pelo site                                                 | `new-user-registration-notification.template.ts` |
| **Senha trocada pelo painel**        | `PATCH /profile/password`                                          | reusa `password-changed.template.ts`             |
| **E-mail de login trocado**          | `PATCH /profile`, `PUT /users/:id`                                 | `email-address-changed.template.ts`              |
| **Cadastro aprovado**                | `PUT /users/:id` com `active: true`                                | `account-approved.template.ts`                   |
| **Papel alterado**                   | `PUT /users/:id` com `role` novo                                   | `role-changed.template.ts`                       |
| **Conta desativada**                 | `PUT /users/:id` com `active: false`                               | `account-deactivated.template.ts`                |
| **Conta excluída**                   | `DELETE /users/:id`                                                | `account-deleted.template.ts`                    |
| **Conta criada pela coordenação**    | `POST /users`                                                      | `account-created-by-admin.template.ts`           |
| **Novo informativo**                 | `POST /informatives`                                               | `informative-published.template.ts`              |
| **Novo documento**                   | `POST /documents`                                                  | `document-published.template.ts`                 |
| **Dia sem Clubinho**                 | `POST /club-control/exceptions`                                    | `club-day-cancelled.template.ts`                 |
| **Confirmação de contato**           | `POST /contact`, para quem escreveu                                | `contact-receipt.template.ts`                    |
| **Pagelas pendentes**                | job de domingo às 8h                                               | `missing-pagela-reminder.template.ts`            |
| **Resumo semanal**                   | job de segunda às 8h                                               | `coordinator-weekly-summary.template.ts`         |
| **Decisão por Cristo**               | `POST /accepted-christs`                                           | `accepted-christ-registered.template.ts`         |

Os três últimos e o "Dia sem Clubinho" têm público recortado; os demais avisos
gerais vão para toda a base ativa. Ver **Quem recebe cada aviso** abaixo.

O botão do resumo semanal abre `adm/resumo-semanal`
(`CLUB_CONTROL_PATHS.weeklySummary`), onde a semana relatada aparece ao lado de
todas as anteriores. Antes ele apontava para `adm/controle-clubinhos`, que é
rota exclusiva do administrador: o coordenador clicava e era redirecionado ao
painel, sem nada sobre o resumo que acabara de ler.

## Quem recebe cada aviso

Há quatro públicos, e cada um vem de um lugar:

| Público           | De onde sai                                              | Usado por                                                  |
| ----------------- | -------------------------------------------------------- | ---------------------------------------------------------- |
| A própria pessoa  | o registro em questão                                    | avisos de conta                                            |
| Administradores   | `GetUsersService.findAdminEmails()`                      | avisos internos                                            |
| Toda a base ativa | `GetUsersService.findActiveRecipients()`                 | material, evento, informativo, documento, dia sem Clubinho |
| Um clubinho       | `GetClubRecipientsService.forClub()`                     | pagelas pendentes, decisão por Cristo                      |
| Um coordenador    | `GetCoordinatorProfilesService.findAllActiveWithClubs()` | resumo semanal                                             |

**A régua de elegibilidade é uma só, e mora no `core/user`.** As consultas de
clubinho já trazem `teachers[].user.email` e `coordinator.user.email`, mas não
sabem nada de `active` nem de `noticesUnsubscribedAt` — trariam o professor
desativado e quem pediu para sair dos avisos. Por isso
`GetClubRecipientsService` responde **quem** tem a ver com o clube e
`GetUsersService.findNoticeRecipientsByIds()` responde **se essa pessoa pode
receber**. Nenhum módulo reescreve essa regra.

Três e-mails saem **sem** rodapé de descadastro, e é de propósito: a troca de
endereço de login (vai para um endereço que já não é da conta), a exclusão de
conta (a linha do usuário não existe mais, e não há token a assinar) e a
confirmação de contato (quem escreveu pelo site não está na base).

## E-mail só vai para conta ativa

A regra geral: **aviso só chega a quem está ativo.** As listas em massa já
nasciam assim — `findActiveRecipients` e `findNoticeRecipientsByIds` filtram
`active` e `noticesUnsubscribedAt`, e é a régua única do `core/user`. O que
faltava era o outro caminho: o envio endereçado a **uma** pessoa, montado a
partir da entidade, que não olhava a situação da conta.

Agora `toEmailRecipient` leva `active` junto, e `EmailService.canReceive` recusa
o envio quando a conta está inativa. A verificação mora no mesmo funil da flag,
então nenhum chamador precisa lembrar dela — e o módulo de e-mail continua sem
depender do de usuário, o que manteria o grafo com ciclo.

### As exceções

Oito notificações saem **mesmo com a conta inativa**, declaradas em
`EMAIL_NOTIFICATIONS_FOR_INACTIVE`. É a mesma lógica do descadastro: cortá-las
trancaria a pessoa para fora da própria conta, ou o destinatário nem é usuário
da base.

| Notificação | Por que é exceção |
| --- | --- |
| `EmailVerification` | A conta nasce inativa; é este e-mail que a ativa |
| `AccountCreatedByAdmin` | Conta criada pela coordenação, ainda sem confirmação |
| `PasswordRecovery` | Sem ela, quem não confirmou o e-mail não recupera a senha |
| `PasswordChanged` | Aviso de segurança sobre a conta da pessoa |
| `EmailAddressChanged` | Vai para o endereço **anterior**, que já não é da conta |
| `AccountDeactivated` | A conta acabou de ficar inativa; o aviso é sobre isso |
| `AccountDeleted` | A linha do usuário não existe mais |
| `ContactReceipt` | Quem escreveu pelo site não está na base |

A lista está presa em teste: ampliá-la sem querer reprova a suíte.

**Administradores também.** `findAdminEmails()` passou a filtrar `active`. Uma
conta de administrador desativada continuava recebendo todo aviso interno —
contato, comentário, avaliação, ideia, imagem, pré-cadastro —, que é justamente
a lista de quem não deveria mais receber nada.

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
    { label: 'Autor', value: data.authorName ?? '' }, // some se vazio
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

| Entrada                | Serviço                 | Aviso                                      |
| ---------------------- | ----------------------- | ------------------------------------------ |
| `POST /contact`        | `CreateContactService`  | `notifyNewContact` — e-mail **e** WhatsApp |
| `POST /site-feedbacks` | `CreateFeedbackService` | `notifyNewSiteFeedback`                    |
| `POST /comments`       | `CreateCommentService`  | `notifyNewComment`                         |

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

| Variável            | Para quê                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| `SMTP_HOST`         | `smtp.gmail.com`                                                                                       |
| `SMTP_PORT`         | `587` (STARTTLS) ou `465` (TLS direto)                                                                 |
| `SMTP_USER`         | conta Gmail que autentica                                                                              |
| `SMTP_PASSWORD`     | **Senha de App** do Google; a senha da conta não funciona com 2FA                                      |
| `MAIL_FROM_NAME`    | nome exibido como remetente                                                                            |
| `MAIL_FROM_ADDRESS` | endereço do remetente; o Gmail reescreve o que não for a conta autenticada ou um alias verificado dela |
| `MAIL_CONTACT_TO`   | destinatários do aviso de contato, separados por vírgula                                               |
| `SITE_BASE_URL`     | base dos links enviados; sem ela vale o mapa por `ENVIRONMENT`                                         |

Sem `SMTP_USER`/`SMTP_PASSWORD` a aplicação sobe normalmente, registra o aviso e
recusa cada envio com `EMAIL_SEND_ERROR` — em vez de fingir que enviou.

## Privacidade

Nenhum log traz endereço de e-mail: o envio é registrado pelo assunto e pela
quantidade de destinatários.

## Reprovação de comentários das fotos do feed

`EmailNotification.FeedPhotoCommentRejected` usa exclusivamente a flag
`email_feed_photo_comment_rejected` (“E-mail: Comentário de Foto Reprovado”).
Nasce ligada, com `targetRoles: []`, e passa por `EmailService.dispatch`.
Envia ao autor o texto e o motivo, depois de confirmar a transação de reprovação.
O aviso no sininho é persistido nessa transação e independe da flag de e-mail e
da disponibilidade do SMTP. Aplicam-se as regras comuns de conta ativa e
descadastro dos avisos. A falha de e-mail é registrada, sem desfazer a revisão.
