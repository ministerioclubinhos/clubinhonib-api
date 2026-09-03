#!/bin/bash

# ==============================================================================
# Script de Deploy Local para ECS - Clubinho NIB API
# ==============================================================================

set -e

# Configurações
API_NAME="clubinho-nib-api"
REPO_NAME="prod-clubinho-nib-api"
AWS_PROFILE="conta-aws"
AWS_REGION="us-east-1"
CLUSTER_NAME="prod-cluster"
SERVICE_NAME="prod-clubinho-nib-api"

# Cores para o terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}--- Iniciando Deploy Local: $API_NAME ---${NC}"

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
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"
docker build -f DockerFile -t "$API_NAME:latest" .
docker tag "$API_NAME:latest" "$REPO_URI:latest"

# 4. Push da Imagem para o ECR
echo -e "${YELLOW}4. Enviando imagem para o ECR...${NC}"
docker push "$REPO_URI:latest"

# 5. Injetar variáveis de ambiente via SSM (Opcional, mas útil se você mudou o .env local)
ENV_FILE="$PROJECT_ROOT/env/prod.env"
if [ -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}5. Sincronizando arquivo .env via SSM...${NC}"
    ENV_B64=$(base64 -w0 "$ENV_FILE")
    
    # Busca todos os ARNs das instâncias registradas no cluster
    ARNS=$(aws ecs list-container-instances --cluster "$CLUSTER_NAME" --profile "$AWS_PROFILE" --region "$AWS_REGION" --query 'containerInstanceArns' --output text)
    
    for ARN in $ARNS; do
        # Busca o ID da EC2 para cada ARN
        INSTANCE_ID=$(aws ecs describe-container-instances --cluster "$CLUSTER_NAME" --container-instances "$ARN" --profile "$AWS_PROFILE" --region "$AWS_REGION" --query 'containerInstances[0].ec2InstanceId' --output text)
        
        echo -e "   -> Atualizando env na instância: $INSTANCE_ID"
        aws ssm send-command \
            --instance-ids "$INSTANCE_ID" \
            --profile "$AWS_PROFILE" \
            --region "$AWS_REGION" \
            --document-name "AWS-RunShellScript" \
            --parameters "commands=[
                'mkdir -p /opt/$API_NAME/env',
                'echo $ENV_B64 | base64 -d > /opt/$API_NAME/env/prod.env'
            ]" --output text > /dev/null
    done
fi

# 6. Forçar atualização do ECS e garantir que tenha pelo menos 1 task rodando
echo -e "${YELLOW}6. Atualizando serviço no ECS...${NC}"
aws ecs update-service \
    --cluster "$CLUSTER_NAME" \
    --service "$SERVICE_NAME" \
    --desired-count 1 \
    --force-new-deployment \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" > /dev/null

echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}   ✅ DEPLOY CONCLUÍDO COM SUCESSO!${NC}"
echo -e "${GREEN}==============================================${NC}"
echo -e "URL: http://$API_NAME.rodolfo-silva.com"
