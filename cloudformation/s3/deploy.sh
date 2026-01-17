#!/bin/bash

# Script para fazer deploy da stack S3 usando o arquivo s3-params.json
# Uso: ./deploy-s3.sh

set -e

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Diretório do script (pasta do serviço)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Profile AWS (pode ser sobrescrito com variável de ambiente)
AWS_PROFILE=${AWS_PROFILE:-clubinho-aws}

# Esperar a stack completar (por padrão: não, para não "travar" o terminal)
WAIT_FOR_COMPLETE=${WAIT_FOR_COMPLETE:-false}

# Retry automático quando o S3 ainda está "liberando" o nome do bucket (409 conflict)
RETRY_ON_S3_CONFLICT=${RETRY_ON_S3_CONFLICT:-true}
S3_CONFLICT_RETRIES=${S3_CONFLICT_RETRIES:-8}
S3_CONFLICT_SLEEP_SECONDS=${S3_CONFLICT_SLEEP_SECONDS:-30}

# Nome da stack
STACK_NAME="clubinho-nib-s3"
TEMPLATE_FILE="stack.yaml"
PARAMS_FILE="params.json"

echo -e "${BLUE}🚀 Deploy da Stack S3 - Clubinhonib${NC}"
echo ""

# Pré-step: se estivermos ADOTANDO um bucket existente e quisermos policy pública,
# precisamos desabilitar Block Public Access no bucket (senão PutBucketPolicy falha com 403).
preconfigure_existing_bucket_public_access() {
    local existing_bucket apply_policy
    existing_bucket=$(python3 - <<'PY'
import json
p=json.load(open('params.json'))
kv={x["ParameterKey"]: x["ParameterValue"] for x in p}
print(kv.get("ExistingBucketName","").strip())
PY
)
    apply_policy=$(python3 - <<'PY'
import json
p=json.load(open('params.json'))
kv={x["ParameterKey"]: x["ParameterValue"] for x in p}
print(kv.get("ApplyBucketPolicyToExistingBucket","false").strip().lower())
PY
)

    if [ -n "$existing_bucket" ] && [ "$apply_policy" = "true" ]; then
        echo -e "${CYAN}🔧 Ajustando Block Public Access do bucket existente: $existing_bucket${NC}"
        aws s3api put-public-access-block \
            --bucket "$existing_bucket" \
            --public-access-block-configuration BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false \
            --profile "$AWS_PROFILE" >/dev/null
        echo -e "${GREEN}✅ Block Public Access ajustado${NC}"
    fi
}

# Verificar se os arquivos existem
if [ ! -f "$TEMPLATE_FILE" ]; then
    echo -e "${RED}❌ Erro: Arquivo $TEMPLATE_FILE não encontrado${NC}"
    exit 1
fi

if [ ! -f "$PARAMS_FILE" ]; then
    echo -e "${RED}❌ Erro: Arquivo $PARAMS_FILE não encontrado${NC}"
    exit 1
fi

# Função para obter status da stack
get_stack_status() {
    aws cloudformation describe-stacks --stack-name "$STACK_NAME" --profile "$AWS_PROFILE" --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "NOT_FOUND"
}

# Função para aguardar stack estar pronta
wait_for_stack() {
    local target_status=$1
    local timeout=${2:-300}  # 5 minutos padrão (S3 é rápido)
    local elapsed=0
    
    echo -e "${CYAN}⏳ Aguardando stack atingir status: $target_status${NC}"
    
    while [ $elapsed -lt $timeout ]; do
        local status=$(get_stack_status)
        
        case "$status" in
            NOT_FOUND)
                # Após deletar uma stack, o DescribeStacks passa a retornar "não encontrado".
                # Trate isso como DELETE_COMPLETE para não "travar" aguardando um status que não volta mais.
                if [ "$target_status" = "DELETE_COMPLETE" ]; then
                    echo -e "${GREEN}✅ Stack deletada (NOT_FOUND)${NC}"
                    return 0
                fi
                sleep 5
                elapsed=$((elapsed + 5))
                ;;
            $target_status)
                echo -e "${GREEN}✅ Stack atingiu status: $status${NC}"
                return 0
                ;;
            CREATE_FAILED|UPDATE_FAILED|ROLLBACK_COMPLETE|ROLLBACK_IN_PROGRESS|DELETE_FAILED|UPDATE_ROLLBACK_COMPLETE|UPDATE_ROLLBACK_FAILED|UPDATE_ROLLBACK_IN_PROGRESS)
                echo -e "${RED}❌ Stack falhou com status: $status${NC}"
                return 1
                ;;
            CREATE_IN_PROGRESS|UPDATE_IN_PROGRESS|DELETE_IN_PROGRESS|ROLLBACK_IN_PROGRESS)
                local seconds=$((elapsed % 60))
                echo -ne "\r${CYAN}⏳ Status: $status... (${elapsed}s)${NC}   "
                sleep 5
                elapsed=$((elapsed + 5))
                ;;
            *)
                sleep 5
                elapsed=$((elapsed + 5))
                ;;
        esac
    done
    
    echo -e "${RED}❌ Timeout aguardando stack${NC}"
    return 1
}

# Função para deletar stack
delete_stack() {
    echo -e "${YELLOW}🗑️  Deletando stack $STACK_NAME...${NC}"
    aws cloudformation delete-stack --stack-name "$STACK_NAME" --profile "$AWS_PROFILE" 2>/dev/null || true
    
    if wait_for_stack "DELETE_COMPLETE" 300; then
        echo -e "${GREEN}✅ Stack deletada com sucesso${NC}"
        return 0
    else
        echo -e "${RED}❌ Erro ao deletar stack${NC}"
        return 1
    fi
}

# Verifica rapidamente se o último erro foi o 409 de "conflicting conditional operation" do S3
stack_has_s3_conflict_error() {
    aws cloudformation describe-stack-events \
        --stack-name "$STACK_NAME" \
        --profile "$AWS_PROFILE" \
        --max-items 25 \
        --query 'StackEvents[0:25].[ResourceStatusReason]' \
        --output text 2>/dev/null | grep -qi "conflicting conditional operation is currently in progress" && return 0
    return 1
}

# Verificar status atual da stack
echo -e "${CYAN}🔍 Verificando status da stack $STACK_NAME...${NC}"
CURRENT_STATUS=$(get_stack_status)

case "$CURRENT_STATUS" in
    NOT_FOUND)
        echo -e "${GREEN}Criando nova stack $STACK_NAME...${NC}"
        OPERATION="create"
        ;;
    CREATE_COMPLETE|UPDATE_COMPLETE)
        echo -e "${YELLOW}Stack $STACK_NAME já existe (Status: $CURRENT_STATUS)${NC}"
        echo -e "${BLUE}Atualizando stack...${NC}"
        OPERATION="update"
        ;;
    CREATE_IN_PROGRESS|UPDATE_IN_PROGRESS)
        echo -e "${YELLOW}⚠️  Stack $STACK_NAME já está sendo criada/atualizada ($CURRENT_STATUS)${NC}"
        echo -e "${YELLOW}   Aguarde a conclusão antes de atualizar${NC}"
        if wait_for_stack "CREATE_COMPLETE" || wait_for_stack "UPDATE_COMPLETE"; then
            echo -e "${GREEN}✅ Stack concluída!${NC}"
            OPERATION="none"
        else
            exit 1
        fi
        ;;
    ROLLBACK_COMPLETE|UPDATE_ROLLBACK_COMPLETE|UPDATE_ROLLBACK_FAILED|DELETE_COMPLETE)
        echo -e "${YELLOW}⚠️  Stack em estado inválido ($CURRENT_STATUS)${NC}"
        echo -e "${CYAN}🗑️  Deletando stack para recriar...${NC}"
        if delete_stack; then
            echo -e "${GREEN}📦 Criando nova stack...${NC}"
            OPERATION="create"
        else
            echo -e "${RED}❌ Não foi possível deletar stack${NC}"
            exit 1
        fi
        ;;
    ROLLBACK_IN_PROGRESS|DELETE_IN_PROGRESS)
        echo -e "${YELLOW}⚠️  Stack em processo de rollback/deleção ($CURRENT_STATUS)${NC}"
        echo -e "${CYAN}⏳ Aguardando conclusão...${NC}"
        if wait_for_stack "DELETE_COMPLETE" 300; then
            echo -e "${GREEN}📦 Criando nova stack...${NC}"
            OPERATION="create"
        else
            echo -e "${RED}❌ Erro durante rollback/deleção${NC}"
            exit 1
        fi
        ;;
    *)
        echo -e "${YELLOW}Stack $STACK_NAME existe com status: $CURRENT_STATUS${NC}"
        echo -e "${BLUE}Tentando atualizar...${NC}"
        OPERATION="update"
        ;;
esac

# Executar deploy
if [ "$OPERATION" = "create" ]; then
    preconfigure_existing_bucket_public_access
    echo -e "${BLUE}📋 Criando stack com template: $TEMPLATE_FILE${NC}"
    echo -e "${BLUE}📋 Usando parâmetros de: $PARAMS_FILE${NC}"
    echo ""
    
    if aws cloudformation create-stack \
        --stack-name "$STACK_NAME" \
        --template-body file://"$TEMPLATE_FILE" \
        --parameters file://"$PARAMS_FILE" \
        --profile "$AWS_PROFILE"; then
        echo ""
        echo -e "${GREEN}✅ Stack criada com sucesso!${NC}"
        echo ""
        echo -e "${YELLOW}⏳ Aguardando criação do bucket (pode levar alguns minutos)...${NC}"
        echo -e "${BLUE}   Você pode acompanhar o progresso com:${NC}"
        echo -e "${BLUE}   aws cloudformation describe-stacks --stack-name $STACK_NAME${NC}"
        if [ "$WAIT_FOR_COMPLETE" = "true" ]; then
            if ! wait_for_stack "CREATE_COMPLETE" 900; then
                if [ "$RETRY_ON_S3_CONFLICT" = "true" ] && stack_has_s3_conflict_error; then
                    echo -e "${YELLOW}⚠️  S3 ainda está liberando o nome do bucket (409). Vou tentar novamente automaticamente...${NC}"
                    for attempt in $(seq 1 "$S3_CONFLICT_RETRIES"); do
                        echo -e "${CYAN}🔁 Retry $attempt/$S3_CONFLICT_RETRIES em ${S3_CONFLICT_SLEEP_SECONDS}s...${NC}"
                        sleep "$S3_CONFLICT_SLEEP_SECONDS"
                        delete_stack || true
                        aws cloudformation create-stack \
                            --stack-name "$STACK_NAME" \
                            --template-body file://"$TEMPLATE_FILE" \
                            --parameters file://"$PARAMS_FILE" \
                            --profile "$AWS_PROFILE" || true
                        if wait_for_stack "CREATE_COMPLETE" 900; then
                            break
                        fi
                        if ! stack_has_s3_conflict_error; then
                            echo -e "${RED}❌ Falhou por outro motivo (não é o 409 do S3).${NC}"
                            exit 1
                        fi
                    done
                else
                    exit 1
                fi
            fi
        fi
    else
        echo ""
        echo -e "${RED}❌ Erro ao criar stack${NC}"
        exit 1
    fi
elif [ "$OPERATION" = "update" ]; then
    preconfigure_existing_bucket_public_access
    echo -e "${BLUE}📋 Atualizando stack com template: $TEMPLATE_FILE${NC}"
    echo -e "${BLUE}📋 Usando parâmetros de: $PARAMS_FILE${NC}"
    echo ""
    
    if aws cloudformation update-stack \
        --stack-name "$STACK_NAME" \
        --template-body file://"$TEMPLATE_FILE" \
        --parameters file://"$PARAMS_FILE" \
        --profile "$AWS_PROFILE"; then
        echo ""
        echo -e "${GREEN}✅ Stack atualizada com sucesso!${NC}"
        echo ""
        echo -e "${YELLOW}⏳ Aguardando atualização (pode levar alguns minutos)...${NC}"
        echo -e "${BLUE}   Você pode acompanhar o progresso com:${NC}"
        echo -e "${BLUE}   aws cloudformation describe-stacks --stack-name $STACK_NAME${NC}"
        if [ "$WAIT_FOR_COMPLETE" = "true" ]; then
            wait_for_stack "UPDATE_COMPLETE" 600
        fi
    else
        update_error=$(aws cloudformation update-stack \
            --stack-name "$STACK_NAME" \
            --template-body file://"$TEMPLATE_FILE" \
            --parameters file://"$PARAMS_FILE" \
            --profile "$AWS_PROFILE" 2>&1 || true)
        
        if echo "$update_error" | grep -q "No updates are to be performed"; then
            echo -e "${GREEN}✅ Nenhuma atualização necessária - stack já está atualizada${NC}"
        elif echo "$update_error" | grep -q "ROLLBACK_COMPLETE" || echo "$update_error" | grep -q "UPDATE_ROLLBACK_COMPLETE"; then
            echo -e "${YELLOW}⚠️  Stack em rollback, deletando para recriar...${NC}"
            if delete_stack; then
                echo -e "${GREEN}📦 Criando nova stack...${NC}"
                aws cloudformation create-stack \
                    --stack-name "$STACK_NAME" \
                    --template-body file://"$TEMPLATE_FILE" \
                    --parameters file://"$PARAMS_FILE" \
                    --profile "$AWS_PROFILE"
                echo -e "${GREEN}✅ Stack criada com sucesso!${NC}"
                if [ "$WAIT_FOR_COMPLETE" = "true" ]; then
                    wait_for_stack "CREATE_COMPLETE" 600
                fi
            else
                echo -e "${RED}❌ Erro ao recriar stack${NC}"
                exit 1
            fi
        else
            echo ""
            echo -e "${RED}❌ Erro ao atualizar stack${NC}"
            echo "$update_error"
            exit 1
        fi
    fi
fi

echo ""
echo -e "${GREEN}📊 Para ver os outputs quando estiver pronto:${NC}"
echo -e "${BLUE}   aws cloudformation describe-stacks --stack-name $STACK_NAME --profile $AWS_PROFILE --query 'Stacks[0].Outputs'${NC}"
