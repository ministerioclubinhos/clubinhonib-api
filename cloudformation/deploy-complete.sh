#!/bin/bash
set -euo pipefail

# Script para deploy NA EC2 (App1) de producao do clubinho-nib-api
# A EC2 vive na alb-shared-infra em conta-aws.

GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}🚀 Iniciando Deploy do Clubinho NIB API (Producao)${NC}"

# 1. Recuperar o ID da instancia e o repositorio ECR
INSTANCE_ID=$(aws cloudformation describe-stacks --profile conta-aws --stack-name alb-shared-infra --query "Stacks[0].Outputs[?OutputKey=='App1InstanceId'].OutputValue" --output text)
PUBLIC_IP=$(aws cloudformation describe-stacks --profile conta-aws --stack-name alb-shared-infra --query "Stacks[0].Outputs[?OutputKey=='App1PublicIP'].OutputValue" --output text)
REPOSITORY_URI=$(aws cloudformation describe-stacks --profile conta-aws --stack-name ecr-repository --query "Stacks[0].Outputs[?OutputKey=='RepositoryUri'].OutputValue" --output text)

if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" == "None" ]; then
    echo -e "${RED}❌ ERRO: Instancia EC2 App1 nao encontrada na stack alb-shared-infra da conta-aws.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ EC2 Instance ID: ${INSTANCE_ID}${NC}"
echo -e "${GREEN}✅ ECR Repository: ${REPOSITORY_URI}${NC}"
echo -e "${GREEN}✅ IP Publico: ${PUBLIC_IP}${NC}"

# 2. Build and Push
REGION="us-east-1"
IMAGE_LATEST="${REPOSITORY_URI}:latest"

echo -e "${CYAN}📦 Executando Build e Push...${NC}"
cd /home/diego-seven/Documents/repositories/clubinho-nib/clubinhonib-api
aws ecr get-login-password --region $REGION --profile conta-aws | docker login --username AWS --password-stdin $REPOSITORY_URI
docker build -f DockerFile -t $IMAGE_LATEST .
docker push $IMAGE_LATEST
echo -e "${GREEN}✅ Build e Push concluidos.${NC}"

# 3. Deploy via SSM
echo -e "${CYAN}🔧 Fazendo deploy via SSM na Instancia ${INSTANCE_ID}...${NC}"

# Usar SEMPRE o arquivo de env de producao existente
ENV_FILE="/home/diego-seven/Documents/repositories/clubinho-nib/clubinhonib-api/env/prod.env"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ ERRO: Arquivo de env de producao nao encontrado em $ENV_FILE.${NC}"
    exit 1
fi
ENV_B64=$(base64 -w0 "$ENV_FILE")

COMMAND_ID=$(aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --profile conta-aws \
    --document-name "AWS-RunShellScript" \
    --parameters "commands=[
        'set -e',
        'aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${REPOSITORY_URI}',
        'mkdir -p /opt/clubinho-nib-api/env',
        'echo ${ENV_B64} | base64 -d > /opt/clubinho-nib-api/env/prod.env',
        'docker stop clubinho-nib-api || true',
        'docker rm clubinho-nib-api || true',
        'docker pull ${IMAGE_LATEST}',
        'docker run -d --name clubinho-nib-api --restart unless-stopped -p 80:3000 -p 3000:3000 --env-file /opt/clubinho-nib-api/env/prod.env ${IMAGE_LATEST}'
    ]" \
    --output text --query 'Command.CommandId')

echo -e "${CYAN}⏳ Comando enviado. Aguardando conclusao (ID: ${COMMAND_ID})...${NC}"
aws ssm wait command-executed --command-id $COMMAND_ID --instance-id $INSTANCE_ID --profile conta-aws || true

STATUS=$(aws ssm get-command-invocation --command-id $COMMAND_ID --instance-id $INSTANCE_ID --profile conta-aws --query 'Status' --output text)

if [ "$STATUS" == "Success" ]; then
    echo -e "${GREEN}✅ Deploy finalizado com Sucesso!${NC}"
    echo -e "${GREEN}🌐 Acesse via: http://${PUBLIC_IP} (ou https://api.clubinhonib.com se o DNS ja propagou)${NC}"
else
    echo -e "${RED}❌ Deploy Falhou (${STATUS}). Verifique os logs no SSM.${NC}"
    exit 1
fi
