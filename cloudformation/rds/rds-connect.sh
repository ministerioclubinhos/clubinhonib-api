#!/bin/bash

# Script unificado para obter informações de conexão e gerar .env
# Uso: ./rds-connect.sh [staging|production] [--generate-env] [--output-file=path]

set -e

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Nome da stack ou ambiente (pode ser nome completo da stack ou staging/production)
STACK_OR_ENV=${1:-staging}

# Se for staging ou production, monta o nome da stack
if [[ "$STACK_OR_ENV" =~ ^(staging|production)$ ]]; then
    STACK_NAME="clubinhonib-rds-${STACK_OR_ENV}"
else
    STACK_NAME="$STACK_OR_ENV"
fi
GENERATE_ENV=false
OUTPUT_FILE="../env/local.env"

# Parse argumentos
for arg in "$@"; do
    case $arg in
        --generate-env)
            GENERATE_ENV=true
            shift
            ;;
        --output-file=*)
            OUTPUT_FILE="${arg#*=}"
            shift
            ;;
        staging|production)
            ENVIRONMENT=$arg
            shift
            ;;
    esac
done

echo -e "${BLUE}🔍 Obtendo informações de conexão do RDS (${STACK_NAME})...${NC}"
echo ""

# Verificar se a stack existe
if ! aws cloudformation describe-stacks --stack-name "$STACK_NAME" &> /dev/null; then
    echo -e "${YELLOW}❌ Erro: Stack $STACK_NAME não encontrada${NC}"
    echo -e "${YELLOW}   Execute primeiro: ./deploy-rds.sh $ENVIRONMENT${NC}"
    exit 1
fi

# Obter informações
ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`PublicEndpoint`].OutputValue' \
    --output text)

PORT=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`DBPort`].OutputValue' \
    --output text)

DB_NAME=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`DBName`].OutputValue' \
    --output text)

DB_USERNAME=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`DBUsername`].OutputValue' \
    --output text)

CONNECTION_STRING=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`ConnectionString`].OutputValue' \
    --output text)

# Mostrar informações
echo -e "${GREEN}✅ Informações de Conexão:${NC}"
echo ""
echo -e "${CYAN}📊 MySQL Workbench:${NC}"
echo "  Hostname: ${GREEN}$ENDPOINT${NC}"
echo "  Port: ${GREEN}$PORT${NC}"
echo "  Username: ${GREEN}$DB_USERNAME${NC}"
echo "  Password: ${YELLOW}[sua senha]${NC}"
echo "  Default Schema: ${GREEN}$DB_NAME${NC}"
echo ""
echo -e "${CYAN}🔗 String de Conexão:${NC}"
echo "  ${GREEN}$CONNECTION_STRING${NC}"
echo ""
echo -e "${CYAN}💻 Para aplicação (.env):${NC}"
echo "  DB_HOST=${GREEN}$ENDPOINT${NC}"
echo "  DB_PORT=${GREEN}$PORT${NC}"
echo "  DB_USERNAME=${GREEN}$DB_USERNAME${NC}"
echo "  DB_PASSWORD=${YELLOW}[sua senha]${NC}"
echo "  DB_NAME=${GREEN}$DB_NAME${NC}"
echo ""
echo -e "${CYAN}🧪 Teste de conexão MySQL:${NC}"
echo "  ${GREEN}mysql -h $ENDPOINT -u $DB_USERNAME -p $DB_NAME${NC}"
echo ""

# Gerar arquivo .env se solicitado
if [ "$GENERATE_ENV" = true ]; then
    echo -e "${BLUE}📝 Gerando arquivo .env...${NC}"
    
    # Criar diretório se não existir
    mkdir -p "$(dirname "$OUTPUT_FILE")"
    
    # Gerar conteúdo
    cat > "$OUTPUT_FILE" << EOF
ENVIRONMENT=local

# Database Configuration - RDS AWS ($ENVIRONMENT)
# Gerado automaticamente em $(date)
DB_HOST=$ENDPOINT
DB_PORT=$PORT
DB_USERNAME=$DB_USERNAME
DB_PASSWORD=CHANGE_THIS_PASSWORD
DB_NAME=$DB_NAME

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_S3_BUCKET_NAME=your_bucket_name

# Email Configuration (SES)
SES_DEFAULT_FROM=no-reply@yourdomain.com
SES_DEFAULT_TO=your-email@example.com

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your_refresh_secret_key
JWT_REFRESH_EXPIRES_IN=14d

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+1234567890
TWILIO_WHATSAPP_TO=whatsapp:+1234567890

# Feed Configuration
FEED_CLUBINHO_PAGE_ID=your_page_id

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
EOF

    echo -e "${GREEN}✅ Arquivo .env gerado em: $OUTPUT_FILE${NC}"
    echo -e "${YELLOW}⚠️  Não esqueça de editar a senha (DB_PASSWORD) no arquivo!${NC}"
    echo ""
fi
