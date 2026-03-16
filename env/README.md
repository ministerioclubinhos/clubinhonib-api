# Environment Variables

Este diretório contém os arquivos de configuração de ambiente para a aplicação Clubinho NIB API.

## 📁 Estrutura

```
env/
├── local.env              # Configurações para desenvolvimento local
├── local.env.example      # Template para configurações locais
├── staging.env            # Configurações para ambiente de staging (AWS)
├── staging.env.example    # Template para configurações de staging
├── prod.env              # Configurações para ambiente de produção (AWS)
└── prod.env.example      # Template para configurações de produção
```

## 🚀 Uso

### Desenvolvimento Local

```bash
npm run start:local
```

Usa o arquivo `env/local.env` para rodar a aplicação localmente.

### Staging

```bash
npm run start:staging
```

Usa o arquivo `env/staging.env` (conecta ao banco staging na AWS).

### Production

```bash
npm run start:prod
```

Usa o arquivo `env/prod.env` (conecta ao banco production na AWS).

## 🔧 Configuração Inicial

1. Copie os arquivos `.example` e remova o sufixo `.example`:
   ```bash
   cp env/local.env.example env/local.env
   ```

2. Edite o arquivo copiado com suas credenciais locais:
   - Configurações do banco de dados MySQL
   - Credenciais AWS (S3, SES)
   - Secrets JWT
   - API keys (Twilio, Google OAuth, etc.)

## 📋 Variáveis Obrigatórias

### Database
- `DB_HOST` - Host do banco MySQL
- `DB_PORT` - Porta do banco (padrão: 3306)
- `DB_USERNAME` - Usuário do banco
- `DB_PASSWORD` - Senha do banco
- `DB_NAME` - Nome do banco

### AWS (uso geral da aplicação – S3, SES)
- `AWS_REGION` - Região AWS (padrão: us-east-1)
- `AWS_ACCESS_KEY_ID` - Access Key da AWS **para uso da aplicação** (S3, SES)
- `AWS_SECRET_ACCESS_KEY` - Secret Key da AWS **para uso da aplicação**
- `AWS_S3_BUCKET_NAME` - Nome do bucket S3

**Separação de credenciais:** existem dois conjuntos distintos:
- **Deploy/LB** (`AWS_DEPLOY_ACCESS_KEY_ID`, `AWS_DEPLOY_SECRET_ACCESS_KEY`): usados apenas pelo GitHub Actions para ECR, ELB, SSM. Configurados só nos **GitHub Secrets**, nunca nos arquivos `.env`.
- **App/Geral** (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` em runtime): usados pela aplicação para S3 e SES. Em produção o CD injeta via secrets `PROD_AWS_ACCESS_KEY_ID` e `PROD_AWS_SECRET_ACCESS_KEY`.

### JWT
- `JWT_SECRET` - Secret para geração de tokens de acesso
- `JWT_REFRESH_SECRET` - Secret para geração de refresh tokens
- `JWT_EXPIRES_IN` - Tempo de expiração do access token (ex: 1h, 7d)
- `JWT_REFRESH_EXPIRES_IN` - Tempo de expiração do refresh token (ex: 7d, 14d)

### Email (SES)
- `SES_DEFAULT_FROM` - Email remetente padrão
- `SES_DEFAULT_TO` - Email(s) destinatário(s) padrão

## 🔐 GitHub Secrets (deploy)

**Compartilhados (deploy/LB):** usados pelo CD para ECR, ELB/EC2, SSM.

| Secret | Uso |
|--------|-----|
| `AWS_DEPLOY_ACCESS_KEY_ID` | Credencial **exclusiva deploy/LB** |
| `AWS_DEPLOY_SECRET_ACCESS_KEY` | Mesmo par do acima |

**Produção** (`.github/workflows/deploy-prod.yml`):

| Secret | Uso |
|--------|-----|
| `AWS_ACCESS_KEY_ID` | Credencial **geral da aplicação** (S3, SES) – injetada no .env do servidor |
| `AWS_SECRET_ACCESS_KEY` | Mesmo par do acima |

**Staging** (quando reativar `deploy-staging.yml`):

| Secret | Uso |
|--------|-----|
| `STAGING_AWS_ACCESS_KEY_ID` | Credencial geral da aplicação em staging (S3, SES) |
| `STAGING_AWS_SECRET_ACCESS_KEY` | Mesmo par do acima |

O backend sempre lê `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY` no servidor; o workflow de prod usa os secrets `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` (app); o de staging usa `STAGING_AWS_*`.

## 🔒 Segurança

⚠️ **IMPORTANTE:**
- Nunca commite os arquivos `.env` no Git
- Use senhas fortes e únicas para cada ambiente
- Rotacione as credenciais regularmente
- Os arquivos `.env` já estão no `.gitignore`
- Mantenha IAM separado: um usuário/chave para deploy (ECR, ELB, SSM) e outro para a app (S3, SES)

## 🚀 Deploy AWS

Os arquivos `staging.env` e `prod.env` são usados pelo script de deploy:

```bash
# Deploy staging
cd cloudformation/ec2
AWS_PROFILE=clubinho-aws bash deploy-complete.sh staging

# Deploy production
cd cloudformation/ec2
AWS_PROFILE=clubinho-aws bash deploy-complete.sh production
```

O script automaticamente:
1. Faz build da imagem Docker
2. Envia para o ECR
3. Faz deploy na EC2 com as variáveis de ambiente corretas
