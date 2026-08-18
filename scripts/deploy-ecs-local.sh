#!/bin/bash

# ==============================================================================
# Script de Deploy Local para ECS - Clubinho NIB API
# ==============================================================================

set -e
set -o pipefail

# Configurações
API_NAME="clubinho-nib-api"
REPO_NAME="prod-clubinho-nib-api"
AWS_PROFILE="conta-aws"
AWS_REGION="us-east-1"
CLUSTER_NAME="prod-cluster"
SERVICE_NAME="prod-clubinho-nib-api"
CONTAINER_NAME="clubinho-nib-api"
ENV_FILE=""

# Cores para o terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}--- Iniciando Deploy Local: $API_NAME ---${NC}"

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/env/prod.env"
TASK_DEF_FILE="$(mktemp)"
TASK_DEF_RENDERED_FILE="$(mktemp)"
trap 'rm -f "$TASK_DEF_FILE" "$TASK_DEF_RENDERED_FILE"' EXIT

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo -e "${RED}Erro: comando obrigatório não encontrado: $1${NC}"
        exit 1
    fi
}

get_env_value() {
    local key="$1"
    local line
    line=$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)
    if [ -z "$line" ]; then
        echo ""
        return
    fi

    local value="${line#*=}"
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    echo "$value"
}

require_env_value() {
    local key="$1"
    local value
    value="$(get_env_value "$key")"
    if [ -z "$value" ]; then
        echo -e "${RED}Erro: variável obrigatória ausente ou vazia em $ENV_FILE: $key${NC}"
        exit 1
    fi
}

require_command jq

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Erro: arquivo de ambiente não encontrado: $ENV_FILE${NC}"
    exit 1
fi

REQUIRED_ENV_KEYS=(
    ENVIRONMENT
    DB_HOST
    DB_PORT
    DB_USERNAME
    DB_PASSWORD
    DB_NAME
    AWS_REGION
    AWS_S3_BUCKET_NAME
    JWT_SECRET
    JWT_REFRESH_SECRET
    JWT_EXPIRES_IN
    JWT_REFRESH_EXPIRES_IN
)

for key in "${REQUIRED_ENV_KEYS[@]}"; do
    require_env_value "$key"
done

if [ "$(get_env_value AWS_S3_BUCKET_NAME)" != "clubinho-nib-storage" ]; then
    echo -e "${RED}Erro: AWS_S3_BUCKET_NAME deve ser clubinho-nib-storage em $ENV_FILE.${NC}"
    exit 1
fi

if [ -n "$(get_env_value AWS_ACCESS_KEY_ID)" ] || [ -n "$(get_env_value AWS_SECRET_ACCESS_KEY)" ]; then
    echo -e "${YELLOW}Aviso: AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY existem no env/prod.env, mas não serão enviados ao container ECS.${NC}"
    echo -e "${YELLOW}       O container deve usar a IAM Task Role para S3/SES.${NC}"
fi

# 1. Recuperar URL do ECR
echo -e "${YELLOW}1. Recuperando URL do Repositório ECR...${NC}"
REPO_URI=$(aws ecr describe-repositories \
    --repository-names "$REPO_NAME" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --query 'repositories[0].repositoryUri' \
    --output text)

if [ -z "$REPO_URI" ]; then
    echo -e "${RED}Erro: Repositório ECR $REPO_NAME não encontrado.${NC}"
    exit 1
fi

# 2. Autenticar Docker na AWS
echo -e "${YELLOW}2. Autenticando Docker na AWS...${NC}"
aws ecr get-login-password --region "$AWS_REGION" --profile "$AWS_PROFILE" | \
    docker login --username AWS --password-stdin "$REPO_URI"

# 3. Build da Imagem Docker
echo -e "${YELLOW}3. Gerando Imagem Docker...${NC}"
# Volta para a raiz do projeto (onde está o DockerFile)
cd "$PROJECT_ROOT"
docker build -f DockerFile -t "$API_NAME:latest" .
docker tag "$API_NAME:latest" "$REPO_URI:latest"

# 4. Push da Imagem para o ECR
echo -e "${YELLOW}4. Enviando imagem para o ECR...${NC}"
docker push "$REPO_URI:latest"

# 5. Registrar nova task definition com imagem e variáveis do env/prod.env
echo -e "${YELLOW}5. Registrando task definition com env/prod.env...${NC}"
aws ecs describe-task-definition \
    --task-definition "$SERVICE_NAME" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --query taskDefinition \
    --output json \
| jq 'del(
    .taskDefinitionArn,
    .revision,
    .status,
    .requiresAttributes,
    .compatibilities,
    .registeredAt,
    .registeredBy,
    .deregisteredAt
)' > "$TASK_DEF_FILE"

NEW_TASK_DEF_ARN=$(jq \
    --arg container "$CONTAINER_NAME" \
    --arg image "$REPO_URI:latest" \
    --arg environment "$(get_env_value ENVIRONMENT)" \
    --arg port "$(get_env_value PORT)" \
    --arg awsRegion "$(get_env_value AWS_REGION)" \
    --arg bucket "$(get_env_value AWS_S3_BUCKET_NAME)" \
    --arg dbHost "$(get_env_value DB_HOST)" \
    --arg dbPort "$(get_env_value DB_PORT)" \
    --arg dbUsername "$(get_env_value DB_USERNAME)" \
    --arg dbPassword "$(get_env_value DB_PASSWORD)" \
    --arg dbName "$(get_env_value DB_NAME)" \
    --arg jwtSecret "$(get_env_value JWT_SECRET)" \
    --arg jwtExpiresIn "$(get_env_value JWT_EXPIRES_IN)" \
    --arg jwtRefreshSecret "$(get_env_value JWT_REFRESH_SECRET)" \
    --arg jwtRefreshExpiresIn "$(get_env_value JWT_REFRESH_EXPIRES_IN)" \
    --arg sesDefaultFrom "$(get_env_value SES_DEFAULT_FROM)" \
    --arg sesDefaultTo "$(get_env_value SES_DEFAULT_TO)" \
    --arg twilioAccountSid "$(get_env_value TWILIO_ACCOUNT_SID)" \
    --arg twilioAuthToken "$(get_env_value TWILIO_AUTH_TOKEN)" \
    --arg twilioWhatsappFrom "$(get_env_value TWILIO_WHATSAPP_FROM)" \
    --arg twilioWhatsappTo "$(get_env_value TWILIO_WHATSAPP_TO)" \
    --arg feedClubinhoPageId "$(get_env_value FEED_CLUBINHO_PAGE_ID)" \
    --arg googleClientId "$(get_env_value GOOGLE_CLIENT_ID)" \
    --arg domainName "$(get_env_value DOMAIN_NAME)" \
    '
    def envpair($name; $value): {name: $name, value: ($value // "")};
    .containerDefinitions = (.containerDefinitions | map(
        if .name == $container then
            .image = $image
            | .environment = [
                envpair("ENVIRONMENT"; $environment),
                envpair("PORT"; (if $port == "" then "3000" else $port end)),
                envpair("AWS_REGION"; $awsRegion),
                envpair("AWS_S3_BUCKET_NAME"; $bucket),
                envpair("DB_HOST"; $dbHost),
                envpair("DB_PORT"; $dbPort),
                envpair("DB_USERNAME"; $dbUsername),
                envpair("DB_PASSWORD"; $dbPassword),
                envpair("DB_NAME"; $dbName),
                envpair("JWT_SECRET"; $jwtSecret),
                envpair("JWT_EXPIRES_IN"; $jwtExpiresIn),
                envpair("JWT_REFRESH_SECRET"; $jwtRefreshSecret),
                envpair("JWT_REFRESH_EXPIRES_IN"; $jwtRefreshExpiresIn),
                envpair("SES_DEFAULT_FROM"; $sesDefaultFrom),
                envpair("SES_DEFAULT_TO"; $sesDefaultTo),
                envpair("TWILIO_ACCOUNT_SID"; $twilioAccountSid),
                envpair("TWILIO_AUTH_TOKEN"; $twilioAuthToken),
                envpair("TWILIO_WHATSAPP_FROM"; $twilioWhatsappFrom),
                envpair("TWILIO_WHATSAPP_TO"; $twilioWhatsappTo),
                envpair("FEED_CLUBINHO_PAGE_ID"; $feedClubinhoPageId),
                envpair("GOOGLE_CLIENT_ID"; $googleClientId),
                envpair("DOMAIN_NAME"; $domainName)
            ]
        else
            .
        end
    ))
    ' "$TASK_DEF_FILE" > "$TASK_DEF_RENDERED_FILE" \
    && aws ecs register-task-definition \
        --cli-input-json "file://$TASK_DEF_RENDERED_FILE" \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text)

echo -e "   -> Nova task definition: ${GREEN}$NEW_TASK_DEF_ARN${NC}"

# 6. Atualizar ECS para a task definition registrada
echo -e "${YELLOW}6. Atualizando serviço no ECS...${NC}"
aws ecs update-service \
    --cluster "$CLUSTER_NAME" \
    --service "$SERVICE_NAME" \
    --task-definition "$NEW_TASK_DEF_ARN" \
    --desired-count 1 \
    --force-new-deployment \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" > /dev/null

echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}   ✅ DEPLOY CONCLUÍDO COM SUCESSO!${NC}"
echo -e "${GREEN}==============================================${NC}"
echo -e "URL: http://$API_NAME.rodolfo-silva.com"
