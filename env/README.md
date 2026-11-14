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

| Variável                                                                                                                                                     | Para quê                                                                  | Sem ela                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `ENVIRONMENT`                                                                                                                                                | prefixo das chaves no S3 e site padrão dos links                          | uploads sem prefixo e links para localhost                          |
| `PORT`                                                                                                                                                       | porta HTTP                                                                | 3000                                                                |
| `SITE_BASE_URL`                                                                                                                                              | base dos links enviados por e-mail                                        | cai no mapa por `ENVIRONMENT`                                       |
| `DB_HOST` `DB_PORT` `DB_USERNAME` `DB_PASSWORD` `DB_NAME`                                                                                                    | conexão MySQL                                                             | usa os padrões e não conecta                                        |
| `AWS_REGION` `AWS_S3_BUCKET_NAME`                                                                                                                            | bucket dos uploads                                                        | upload e remoção falham                                             |
| `JWT_SECRET` `JWT_EXPIRES_IN` `JWT_REFRESH_SECRET` `JWT_REFRESH_EXPIRES_IN`                                                                                  | tokens de acesso e refresh                                                | a aplicação não sobe                                                |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASSWORD`                                                                                                          | envio de e-mail                                                           | sobe com aviso e recusa cada envio                                  |
| `MAIL_FROM_NAME` `MAIL_FROM_ADDRESS`                                                                                                                         | remetente exibido                                                         | usa o nome padrão e a conta autenticada                             |
| `GOOGLE_CLIENT_ID`                                                                                                                                           | login com Google                                                          | login com Google falha                                              |
| `TWILIO_ACCOUNT_SID` `TWILIO_AUTH_TOKEN` `TWILIO_WHATSAPP_FROM` `TWILIO_WHATSAPP_TO`                                                                         | aviso de contato por WhatsApp                                             | o aviso por WhatsApp é ignorado                                     |
| `FEED_CLUBINHO_PAGE_ID`                                                                                                                                      | página de imagens usada como feed                                         | a atualização de seção do feed falha                                |
| `OBS_STORAGE` `OBS_LOCAL_DIR` `OBS_TTL_DAYS`                                                                                                                 | destino, pasta e retenção (dias) dos registros técnicos                   | `file`, `logs`, `1`                                                 |
| `AUDIT_STORAGE` `AUDIT_LOCAL_DIR` `AUDIT_TTL_DAYS` `AUDIT_DEDUP_SECONDS`                                                                                     | destino, pasta, retenção e janela de desduplicação da auditoria           | `file`, `audit`, `1`, `60`                                          |
| `LOG_DYNAMODB_TABLE_NAME` `LOG_DYNAMODB_ENDPOINT`                                                                                                            | tabela DynamoDB compartilhada pelos dois fluxos e endpoint local opcional | obrigatória quando algum fluxo é `dynamodb`; sem endpoint usa a AWS |
| `AI_PROVIDER_SETTINGS_ENCRYPTION_KEY` `AI_PROVIDER_SETTINGS_ENCRYPTION_KEY_PREVIOUS` | chave mestra (e a anterior, só durante rotação) que criptografa as chaves de API dos provedores de IA salvas no banco | sem ela as chaves ficam em texto puro; em produção, salvar nova chave é recusado |
| `REDIS_URL` `AI_QUEUE_PREFIX` `AI_QUEUE_CONCURRENCY` `AI_QUEUE_WAIT_MS` | fila de requisições de IA (BullMQ): conexão, prefixo, concorrência global e espera máxima | `redis://127.0.0.1:6379/0`, `clubinho`, `1`, `900000`; sem Redis as rotas de IA ficam indisponíveis |
| `AI_LESSONS_MAX_CONCURRENT_GENERATIONS` `PDF_CONVERSION_MAX_CONCURRENCY` | gerações de etapa e conversões PDF simultâneas por instância | `3`, `2` |
| `LESSON_HEADER_LEFT_PATH` `LESSON_HEADER_RIGHT_PATH` `MEDITATION_HEADER_LEFT_PATH` | caminhos opcionais que substituem os cabeçalhos PNG empacotados usados nos PDFs do Estúdio | usa os arquivos de `src/modules/ai-lessons/assets` |

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

## Observabilidade e auditoria

Os dois fluxos aceitam `file` (JSONL em pasta local, um arquivo por dia UTC e
por processo, **só para análise**: a API não lista nem apaga) ou `dynamodb`
(tabela compartilhada, TTL por item, consultável e apagável pela tela de
administração). No desenvolvimento, `dynamodb` aponta para o DynamoDB Local
que o `run.sh` sobe no Docker (`LOG_DYNAMODB_ENDPOINT=http://localhost:8000`);
a tabela é criada automaticamente se não existir. Variável
ausente recebe o valor padrão acima; variável presente e inválida derruba a
subida com mensagem segura. `file` explícito é recusado quando `ENVIRONMENT`
é `staging`, `prod` ou `production`, porque o container não tem volume. As
pastas `logs` e `audit` estão no `.gitignore`. Detalhes em
[`../docs/observability-audit.md`](../docs/observability-audit.md).

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
