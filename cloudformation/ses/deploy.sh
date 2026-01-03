#!/bin/bash

# Script para fazer deploy da stack SES usando o arquivo ses-params.json
# Uso: ./deploy-ses.sh

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

# Nome da stack e arquivos (no próprio diretório)
STACK_NAME="clubinho-nib-ses"
TEMPLATE_FILE="stack.yaml"
PARAMS_FILE="params.json"
TMP_PARAMS=""
# Gerar arquivo de parâmetros temporário (preenche HostedZoneId automaticamente se vazio)
build_params() {
    local domain
    local hosted_zone

    # Extrair Domain e HostedZoneId atuais
    readarray -t extracted < <(python3 - <<'PY'
import json
import sys
params = json.load(open("params.json"))
domain = ""
hosted = ""
for item in params:
    if item.get("ParameterKey") == "Domain":
        domain = item.get("ParameterValue", "")
    if item.get("ParameterKey") == "HostedZoneId":
        hosted = item.get("ParameterValue", "")
print(domain)
print(hosted)
PY
)
    domain="${extracted[0]}"
    hosted_zone="${extracted[1]}"

    # Se não houver HostedZoneId, buscar no Route53
    if [ -z "$hosted_zone" ] || [ "$hosted_zone" = "None" ]; then
        if [ -n "$domain" ]; then
            hosted_zone=$(aws route53 list-hosted-zones-by-name \
                --dns-name "$domain" \
                --query 'HostedZones[0].Id' \
                --output text \
                --profile "$AWS_PROFILE" 2>/dev/null | sed 's#.*/##')
        fi
    fi

    # Gerar params temporário
    TMP_PARAMS=$(mktemp)
    export TMP_PARAMS
    AWS_PROFILE="$AWS_PROFILE" DOMAIN="$domain" HOSTED_ZONE="$hosted_zone" python3 - <<'PY'
import json, os
params = json.load(open("params.json"))
domain = os.environ.get("DOMAIN","")
hz = os.environ.get("HOSTED_ZONE","")
for item in params:
    if item.get("ParameterKey") == "HostedZoneId":
        if hz:
            item["ParameterValue"] = hz
    if item.get("ParameterKey") == "Domain" and domain:
        item["ParameterValue"] = domain
json.dump(params, open(os.environ["TMP_PARAMS"], "w"), indent=2)
PY
    PARAMS_FILE="$TMP_PARAMS"
}

# Limpar TMP em saída
cleanup() {
    if [ -n "$TMP_PARAMS" ] && [ -f "$TMP_PARAMS" ]; then
        rm -f "$TMP_PARAMS"
    fi
}
trap cleanup EXIT

build_params

echo -e "${BLUE}🚀 Deploy da Stack SES - Clubinhonib${NC}"
echo ""

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
    local timeout=${2:-300}  # 5 minutos padrão
    local elapsed=0
    
    echo -e "${CYAN}⏳ Aguardando stack atingir status: $target_status${NC}"
    
    while [ $elapsed -lt $timeout ]; do
        local status=$(get_stack_status)
        
        case "$status" in
            $target_status)
                echo -e "${GREEN}✅ Stack atingiu status: $status${NC}"
                return 0
                ;;
            CREATE_FAILED|UPDATE_FAILED|ROLLBACK_COMPLETE|ROLLBACK_IN_PROGRESS|DELETE_FAILED)
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
    ROLLBACK_COMPLETE|DELETE_COMPLETE)
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
        echo -e "${YELLOW}⏳ Aguardando criação (pode levar alguns minutos)...${NC}"
        echo -e "${BLUE}   Você pode acompanhar o progresso com:${NC}"
        echo -e "${BLUE}   aws cloudformation describe-stacks --stack-name $STACK_NAME${NC}"
    else
        echo ""
        echo -e "${RED}❌ Erro ao criar stack${NC}"
        exit 1
    fi
elif [ "$OPERATION" = "update" ]; then
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
    else
        local update_error=$(aws cloudformation update-stack \
            --stack-name "$STACK_NAME" \
            --template-body file://"$TEMPLATE_FILE" \
            --parameters file://"$PARAMS_FILE" \
            --profile "$AWS_PROFILE" 2>&1 || true)
        
        if echo "$update_error" | grep -q "No updates are to be performed"; then
            echo -e "${GREEN}✅ Nenhuma atualização necessária - stack já está atualizada${NC}"
        elif echo "$update_error" | grep -q "ROLLBACK_COMPLETE"; then
            echo -e "${YELLOW}⚠️  Stack em ROLLBACK_COMPLETE, deletando para recriar...${NC}"
            if delete_stack; then
                echo -e "${GREEN}📦 Criando nova stack...${NC}"
                aws cloudformation create-stack \
                    --stack-name "$STACK_NAME" \
                    --template-body file://"$TEMPLATE_FILE" \
                    --parameters file://"$PARAMS_FILE" \
                    --profile "$AWS_PROFILE" \
                    --profile "$AWS_PROFILE"
                echo -e "${GREEN}✅ Stack criada com sucesso!${NC}"
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
