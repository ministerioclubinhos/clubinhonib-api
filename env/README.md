# Variáveis de ambiente

Arquivos de configuração da Clubinho NIB API.

## Estrutura

```
env/
├── local.env / local.env.example        # desenvolvimento local
├── dev.env                              # ambiente de desenvolvimento
├── staging.env.example                  # template de staging
└── prod.env.example                     # template de produção
```

Os arquivos com valores reais (`local.env`, `dev.env`, `prod.env`) **não vão
para o Git**. Os `.example` são o contrato: toda variável que a aplicação lê
está neles.

## Uso

```bash
npm run start:local     # usa env/local.env
npm run start:staging   # usa env/staging.env
npm run start:prod      # usa env/prod.env
```

O caminho vem de `ENV_FILE`, definido pelo próprio script — **não** coloque
`ENV_FILE` dentro do arquivo de ambiente.

Para começar:

```bash
cp env/local.env.example env/local.env
```

## Variáveis lidas pela aplicação

| Variável | Para quê | Sem ela |
|---|---|---|
| `ENVIRONMENT` | prefixo das chaves no S3 e site padrão dos links | uploads sem prefixo e links para localhost |
| `PORT` | porta HTTP | 3000 |
| `SITE_BASE_URL` | base dos links enviados por e-mail | cai no mapa por `ENVIRONMENT` |
| `DB_HOST` `DB_PORT` `DB_USERNAME` `DB_PASSWORD` `DB_NAME` | conexão MySQL | usa os padrões e não conecta |
| `AWS_REGION` `AWS_S3_BUCKET_NAME` | bucket dos uploads | upload e remoção falham |
| `JWT_SECRET` `JWT_EXPIRES_IN` `JWT_REFRESH_SECRET` `JWT_REFRESH_EXPIRES_IN` | tokens de acesso e refresh | a aplicação não sobe |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASSWORD` | envio de e-mail | sobe com aviso e recusa cada envio |
| `MAIL_FROM_NAME` `MAIL_FROM_ADDRESS` | remetente exibido | usa o nome padrão e a conta autenticada |
| `GOOGLE_CLIENT_ID` | login com Google | login com Google falha |
| `TWILIO_ACCOUNT_SID` `TWILIO_AUTH_TOKEN` `TWILIO_WHATSAPP_FROM` `TWILIO_WHATSAPP_TO` | aviso de contato por WhatsApp | o aviso por WhatsApp é ignorado |
| `FEED_CLUBINHO_PAGE_ID` | página de imagens usada como feed | a atualização de seção do feed falha |

### Não lidas pelo código, mas necessárias

- `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY`: o SDK da AWS lê direto do
  ambiente. Em desenvolvimento são obrigatórias; **em produção não devem
  existir**, porque o container usa a IAM Task Role do ECS.
- `DOMAIN_NAME`: usada só pelo workflow de deploy, não pela aplicação.

### Removidas

- `SES_DEFAULT_FROM`, `SES_DEFAULT_TO`: o envio saiu do AWS SES e passou a ser
  SMTP do Gmail.
- `MAIL_CONTACT_TO`: os avisos de contato vão para os administradores
  cadastrados no banco.

## E-mail com Gmail

`SMTP_PASSWORD` é uma **Senha de App** do Google (16 dígitos), não a senha da
conta — com verificação em duas etapas ativa, a senha normal é recusada.
`MAIL_FROM_ADDRESS` precisa ser a conta autenticada ou um alias verificado
nela; qualquer outro remetente é reescrito pelo Gmail.

Detalhes do módulo de e-mail em [`../docs/email.md`](../docs/email.md).

## Deploy

O que vale em produção e staging são as variáveis do workflow
(`.github/workflows/deploy-prod.yml` e `deploy-staging.yml`), que preenchem a
task definition do ECS a partir dos secrets do repositório. Uma variável nova
precisa entrar **nos dois lugares**: no `.example` e no workflow.

## Segurança

- Nunca commite arquivos com valores reais.
- Rotacione credenciais periodicamente.
- Uma senha por ambiente, nunca a mesma.
