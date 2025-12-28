#!/bin/bash

# Script para fazer deploy da stack ECR
# Uso: ./deploy-ecr.sh [environment]
# Exemplo: ./deploy-ecr.sh staging

set -e

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Profile AWS (pode ser sobrescrito com variável de ambiente)
AWS_PROFILE=${AWS_PROFILE:-clubinho-aws}

# Diretório do script (pasta do serviço)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Stack única para ambos os repositórios (staging e prod)
STACK_NAME="clubinho-nib-ecr"
TEMPLATE_FILE="stack.yaml"

echo -e "${BLUE}🚀 Deploy da Stack ECR - Clubinhonib${NC}"
echo -e "${CYAN}Criando repositórios: staging e production${NC}"
echo -e "${CYAN}AWS Profile: ${AWS_PROFILE}${NC}"
echo ""

# Verificar se os arquivos existem
if [ ! -f "$TEMPLATE_FILE" ]; then
    echo -e "${RED}❌ Erro: Arquivo $TEMPLATE_FILE não encontrado${NC}"
    exit 1
fi

# Função para obter status da stack
get_stack_status() {
    aws cloudformation describe-stacks --stack-name "$STACK_NAME" --profile "$AWS_PROFILE" --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "NOT_FOUND"
}

# Verificar status atual da stack
CURRENT_STATUS=$(get_stack_status)

if [ "$CURRENT_STATUS" = "NOT_FOUND" ]; then
    echo -e "${GREEN}Criando nova stack $STACK_NAME...${NC}"
    OPERATION="create"
elif [ "$CURRENT_STATUS" = "CREATE_COMPLETE" ] || [ "$CURRENT_STATUS" = "UPDATE_COMPLETE" ]; then
    echo -e "${YELLOW}Stack $STACK_NAME já existe (Status: $CURRENT_STATUS)${NC}"
    echo -e "${BLUE}Atualizando stack...${NC}"
    OPERATION="update"
elif [ "$CURRENT_STATUS" = "ROLLBACK_COMPLETE" ] || [ "$CURRENT_STATUS" = "DELETE_COMPLETE" ]; then
    echo -e "${YELLOW}⚠️  Stack em estado inválido ($CURRENT_STATUS)${NC}"
    echo -e "${CYAN}🗑️  Deletando stack para recriar...${NC}"
    aws cloudformation delete-stack --stack-name "$STACK_NAME" --profile "$AWS_PROFILE" 2>/dev/null || true
    echo -e "${CYAN}⏳ Aguardando deleção...${NC}"
    sleep 10
    OPERATION="create"
else
    echo -e "${YELLOW}Stack $STACK_NAME existe com status: $CURRENT_STATUS${NC}"
    echo -e "${BLUE}Tentando atualizar...${NC}"
    OPERATION="update"
fi

# Executar deploy
if [ "$OPERATION" = "create" ]; then
    echo -e "${BLUE}📋 Criando stack com template: $TEMPLATE_FILE${NC}"
    echo ""
    
    if aws cloudformation create-stack \
        --stack-name "$STACK_NAME" \
        --template-body file://"$TEMPLATE_FILE" \
        --profile "$AWS_PROFILE"; then
        echo ""
        echo -e "${GREEN}✅ Stack criada com sucesso!${NC}"
        echo -e "${CYAN}📦 Repositórios criados:${NC}"
        echo -e "${CYAN}   - clubinho-nib-api-staging${NC}"
        echo -e "${CYAN}   - clubinho-nib-api-production${NC}"
    else
        echo ""
        echo -e "${RED}❌ Erro ao criar stack${NC}"
        exit 1
    fi
elif [ "$OPERATION" = "update" ]; then
    echo -e "${BLUE}📋 Atualizando stack com template: $TEMPLATE_FILE${NC}"
    echo ""
    
    update_output=$(aws cloudformation update-stack \
        --stack-name "$STACK_NAME" \
        --template-body file://"$TEMPLATE_FILE" \
        --profile "$AWS_PROFILE" 2>&1) || true
    update_exit_code=$?
    
    if [ $update_exit_code -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✅ Stack atualizada com sucesso!${NC}"
    elif echo "$update_output" | grep -q "No updates are to be performed"; then
        echo -e "${GREEN}✅ Nenhuma atualização necessária - stack já está atualizada${NC}"
    else
        echo ""
        echo -e "${RED}❌ Erro ao atualizar stack${NC}"
        echo "$update_output"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}📊 Para ver os outputs:${NC}"
echo -e "${BLUE}   aws cloudformation describe-stacks --stack-name $STACK_NAME --profile $AWS_PROFILE --query 'Stacks[0].Outputs'${NC}"



