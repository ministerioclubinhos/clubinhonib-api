#!/bin/bash

# Script completo para fazer deploy da stack RDS - Cobre todos os cenários
# Uso: bash deploy-rds.sh

set -e

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Diretório do script (pasta do serviço)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Profile AWS (pode ser sobrescrito com variável de ambiente)
AWS_PROFILE=${AWS_PROFILE:-clubinho-aws}

STACK_NAME="geral-aplications-rds"
TEMPLATE_FILE="stack.yaml"
PARAMS_FILE="params.json"

# Função para log
log() {
    echo -e "${1}${2}${NC}"
}

# Função para verificar se comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Verificar pré-requisitos
log "${BLUE}" "╔════════════════════════════════════════════════════════╗"
log "${BLUE}" "║     🚀 Deploy da Stack RDS - Clubinhonib API         ║"
log "${BLUE}" "╚════════════════════════════════════════════════════════╝"
log "" ""

log "${CYAN}" "🔍 Verificando pré-requisitos..."

# Verificar AWS CLI
if ! command_exists aws; then
    log "${RED}" "❌ Erro: AWS CLI não está instalado"
    log "${YELLOW}" "   Instale: https://aws.amazon.com/cli/"
    exit 1
fi

# Profile AWS (pode ser sobrescrito com variável de ambiente)
AWS_PROFILE=${AWS_PROFILE:-clubinho-aws}

# Verificar autenticação AWS
if ! aws sts get-caller-identity --profile "$AWS_PROFILE" &> /dev/null; then
    log "${RED}" "❌ Erro: AWS CLI não está configurado ou não está autenticado"
    log "${YELLOW}" "   Execute: aws configure --profile $AWS_PROFILE"
    exit 1
fi

# Verificar arquivos
if [ ! -f "$TEMPLATE_FILE" ]; then
    log "${RED}" "❌ Erro: Arquivo $TEMPLATE_FILE não encontrado"
    exit 1
fi

if [ ! -f "$PARAMS_FILE" ]; then
    log "${RED}" "❌ Erro: Arquivo $PARAMS_FILE não encontrado"
    exit 1
fi

# Validar JSON dos parâmetros
if ! python3 -m json.tool "$PARAMS_FILE" > /dev/null 2>&1; then
    log "${RED}" "❌ Erro: Arquivo $PARAMS_FILE não é um JSON válido"
    exit 1
fi

log "${GREEN}" "✅ Todos os pré-requisitos atendidos"
log "" ""

# Função para obter status da stack
get_stack_status() {
    aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "NOT_FOUND"
}

# Função para aguardar stack estar pronta
wait_for_stack() {
    local target_status=$1
    local timeout=${2:-1800}  # 30 minutos padrão
    local elapsed=0
    
    log "${CYAN}" "⏳ Aguardando stack atingir status: $target_status"
    log "${YELLOW}" "   (Timeout: $((timeout / 60)) minutos)"
    
    while [ $elapsed -lt $timeout ]; do
        local status=$(get_stack_status)
        
        case "$status" in
            $target_status)
                log "${GREEN}" "✅ Stack atingiu status: $status"
                return 0
                ;;
            CREATE_FAILED|UPDATE_FAILED|ROLLBACK_COMPLETE|ROLLBACK_IN_PROGRESS|DELETE_FAILED)
                log "${RED}" "❌ Stack falhou com status: $status"
                return 1
                ;;
            CREATE_IN_PROGRESS|UPDATE_IN_PROGRESS|DELETE_IN_PROGRESS|ROLLBACK_IN_PROGRESS)
                local minutes=$((elapsed / 60))
                local seconds=$((elapsed % 60))
                echo -ne "\r${CYAN}⏳ Status: $status... (${minutes}m ${seconds}s)${NC}   "
                sleep 10
                elapsed=$((elapsed + 10))
                ;;
            *)
                log "${YELLOW}" "Status atual: $status"
                sleep 5
                elapsed=$((elapsed + 5))
                ;;
        esac
    done
    
    log "${RED}" "❌ Timeout aguardando stack"
    return 1
}

# Função para deletar stack
delete_stack() {
    log "${YELLOW}" "🗑️  Deletando stack $STACK_NAME..."
    aws cloudformation delete-stack --stack-name "$STACK_NAME" 2>/dev/null || true
    
    if wait_for_stack "DELETE_COMPLETE" 600; then
        log "${GREEN}" "✅ Stack deletada com sucesso"
        return 0
    else
        log "${RED}" "❌ Erro ao deletar stack"
        return 1
    fi
}

# Função para verificar se RDS está realmente disponível
check_rds_available() {
    local endpoint=$1
    local max_attempts=30
    local attempt=0
    
    log "${CYAN}" "🔍 Verificando se RDS está disponível..."
    
    while [ $attempt -lt $max_attempts ]; do
        # Tentar obter status do RDS
        local db_status=$(aws rds describe-db-instances \
            --profile "$AWS_PROFILE" \
            --query "DBInstances[?Endpoint.Address=='$endpoint'].DBInstanceStatus" \
            --output text 2>/dev/null || echo "")
        
        if [ "$db_status" = "available" ]; then
            log "${GREEN}" "✅ RDS está disponível!"
            return 0
        elif [ -n "$db_status" ]; then
            echo -ne "\r${YELLOW}⏳ RDS status: $db_status... (tentativa $((attempt + 1))/$max_attempts)${NC}   "
        else
            echo -ne "\r${YELLOW}⏳ Aguardando RDS aparecer... (tentativa $((attempt + 1))/$max_attempts)${NC}   "
        fi
        
        sleep 10
        attempt=$((attempt + 1))
    done
    
    log "${YELLOW}" "⚠️  Não foi possível verificar status do RDS, mas continuando..."
    return 0
}

# Verificar status atual da stack
log "${CYAN}" "🔍 Verificando status da stack $STACK_NAME..."
CURRENT_STATUS=$(get_stack_status)

case "$CURRENT_STATUS" in
    NOT_FOUND)
        log "${GREEN}" "📦 Stack não existe. Criando nova stack..."
        OPERATION="create"
        ;;
    CREATE_COMPLETE|UPDATE_COMPLETE)
        log "${GREEN}" "✅ Stack já existe e está completa"
        log "${BLUE}" "🔄 Atualizando stack com template atual..."
        OPERATION="update"
        ;;
    CREATE_IN_PROGRESS|UPDATE_IN_PROGRESS)
        log "${YELLOW}" "⚠️  Stack já está sendo criada/atualizada ($CURRENT_STATUS)"
        log "${CYAN}" "⏳ Aguardando conclusão..."
        if wait_for_stack "CREATE_COMPLETE" || wait_for_stack "UPDATE_COMPLETE"; then
            log "${GREEN}" "✅ Stack concluída!"
            OPERATION="none"
        else
            log "${RED}" "❌ Stack falhou durante criação/atualização"
            exit 1
        fi
        ;;
    ROLLBACK_COMPLETE|DELETE_COMPLETE)
        log "${YELLOW}" "⚠️  Stack em estado inválido ($CURRENT_STATUS)"
        log "${CYAN}" "🗑️  Deletando stack para recriar..."
        if delete_stack; then
            log "${GREEN}" "📦 Criando nova stack..."
            OPERATION="create"
        else
            log "${RED}" "❌ Não foi possível deletar stack"
            exit 1
        fi
        ;;
    ROLLBACK_IN_PROGRESS|DELETE_IN_PROGRESS)
        log "${YELLOW}" "⚠️  Stack em processo de rollback/deleção ($CURRENT_STATUS)"
        log "${CYAN}" "⏳ Aguardando conclusão..."
        if wait_for_stack "DELETE_COMPLETE" 600; then
            log "${GREEN}" "📦 Criando nova stack..."
            OPERATION="create"
        else
            log "${RED}" "❌ Erro durante rollback/deleção"
            exit 1
        fi
        ;;
    *)
        log "${YELLOW}" "⚠️  Stack existe com status: $CURRENT_STATUS"
        log "${BLUE}" "🔄 Tentando atualizar..."
        OPERATION="update"
        ;;
esac

# Executar operação
if [ "$OPERATION" = "create" ]; then
    log "${BLUE}" "📋 Criando stack com:"
    log "${CYAN}" "   Template: $TEMPLATE_FILE"
    log "${CYAN}" "   Parâmetros: $PARAMS_FILE"
    log "" ""
    
    if aws cloudformation create-stack \
        --stack-name "$STACK_NAME" \
        --template-body file://"$TEMPLATE_FILE" \
        --parameters file://"$PARAMS_FILE" \
        --profile "$AWS_PROFILE" > /dev/null 2>&1; then
        log "${GREEN}" "✅ Comando de criação enviado com sucesso!"
    else
        # Verificar se foi erro de stack já existe
        if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --profile "$AWS_PROFILE" &> /dev/null; then
            log "${YELLOW}" "⚠️  Stack já existe, aguardando conclusão..."
            OPERATION="wait"
        else
            log "${RED}" "❌ Erro ao criar stack"
            log "${YELLOW}" "Verifique os logs acima para mais detalhes"
            exit 1
        fi
    fi
elif [ "$OPERATION" = "update" ]; then
    log "${BLUE}" "📋 Atualizando stack com:"
    log "${CYAN}" "   Template: $TEMPLATE_FILE"
    log "${CYAN}" "   Parâmetros: $PARAMS_FILE"
    log "" ""
    
    if aws cloudformation update-stack \
        --stack-name "$STACK_NAME" \
        --template-body file://"$TEMPLATE_FILE" \
        --parameters file://"$PARAMS_FILE" \
        --profile "$AWS_PROFILE" > /dev/null 2>&1; then
        log "${GREEN}" "✅ Comando de atualização enviado com sucesso!"
    else
        local update_error=$(aws cloudformation update-stack \
            --stack-name "$STACK_NAME" \
            --template-body file://"$TEMPLATE_FILE" \
            --parameters file://"$PARAMS_FILE" \
            --profile "$AWS_PROFILE" 2>&1 || true)
        
        if echo "$update_error" | grep -q "No updates are to be performed"; then
            log "${GREEN}" "✅ Nenhuma atualização necessária - stack já está atualizada"
            OPERATION="wait"
        elif echo "$update_error" | grep -q "cannot be updated"; then
            log "${YELLOW}" "⚠️  Stack não pode ser atualizada no estado atual"
            log "${CYAN}" "Aguardando stack estar pronta..."
            OPERATION="wait"
        else
            log "${YELLOW}" "⚠️  Erro ao atualizar (pode ser que não haja mudanças)"
            log "${CYAN}" "Aguardando stack estar pronta..."
            OPERATION="wait"
        fi
    fi
fi

# Aguardar conclusão se necessário
if [ "$OPERATION" != "none" ]; then
    if wait_for_stack "CREATE_COMPLETE" || wait_for_stack "UPDATE_COMPLETE"; then
        log "" ""
        log "${GREEN}" "╔════════════════════════════════════════════════════════╗"
        log "${GREEN}" "║     ✅ Stack criada/atualizada com sucesso!            ║"
        log "${GREEN}" "╚════════════════════════════════════════════════════════╝"
        log "" ""
    else
        log "" ""
        log "${RED}" "╔════════════════════════════════════════════════════════╗"
        log "${RED}" "║           ❌ Erro ao criar/atualizar stack              ║"
        log "${RED}" "╚════════════════════════════════════════════════════════╝"
        log "" ""
        log "${YELLOW}" "📋 Últimos eventos com erro:"
        aws cloudformation describe-stack-events \
            --stack-name "$STACK_NAME" \
            --max-items 10 \
            --query 'StackEvents[?ResourceStatus==`CREATE_FAILED` || ResourceStatus==`UPDATE_FAILED` || ResourceStatus==`DELETE_FAILED`].[Timestamp,ResourceType,LogicalResourceId,ResourceStatusReason]' \
            --output table 2>/dev/null || true
        exit 1
    fi
fi

# Obter outputs
log "${BLUE}" "📊 Obtendo informações de conexão..."
log "" ""

ENDPOINT=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --profile "$AWS_PROFILE" --query 'Stacks[0].Outputs[?OutputKey==`PublicEndpoint`].OutputValue' --output text 2>/dev/null || echo "")
PORT=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --profile "$AWS_PROFILE" --query 'Stacks[0].Outputs[?OutputKey==`DBPort`].OutputValue' --output text 2>/dev/null || echo "")
DB_NAME=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --profile "$AWS_PROFILE" --query 'Stacks[0].Outputs[?OutputKey==`DBName`].OutputValue' --output text 2>/dev/null || echo "")
DB_USERNAME=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --profile "$AWS_PROFILE" --query 'Stacks[0].Outputs[?OutputKey==`DBUsername`].OutputValue' --output text 2>/dev/null || echo "")

if [ -z "$ENDPOINT" ] || [ "$ENDPOINT" = "None" ]; then
    log "${YELLOW}" "⚠️  Endpoint ainda não está disponível"
    log "${CYAN}" "⏳ Aguardando RDS ser criado (pode levar mais alguns minutos)..."
    sleep 30
    
    # Tentar novamente
    ENDPOINT=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --profile "$AWS_PROFILE" --query 'Stacks[0].Outputs[?OutputKey==`PublicEndpoint`].OutputValue' --output text 2>/dev/null || echo "")
fi

if [ -n "$ENDPOINT" ] && [ "$ENDPOINT" != "None" ]; then
    # Verificar se RDS está disponível
    check_rds_available "$ENDPOINT"
    
    log "" ""
    log "${GREEN}" "╔════════════════════════════════════════════════════════╗"
    log "${GREEN}" "║          📋 Informações de Conexão RDS                 ║"
    log "${GREEN}" "╚════════════════════════════════════════════════════════╝"
    log "" ""
    log "${CYAN}" "   Host:     ${GREEN}$ENDPOINT${NC}"
    log "${CYAN}" "   Port:     ${GREEN}$PORT${NC}"
    log "${CYAN}" "   Database: ${GREEN}$DB_NAME${NC}"
    log "${CYAN}" "   Username: ${GREEN}$DB_USERNAME${NC}"
    log "${CYAN}" "   Password: ${YELLOW}(verifique em $PARAMS_FILE)${NC}"
    log "" ""
    log "${BLUE}" "╔════════════════════════════════════════════════════════╗"
    log "${BLUE}" "║              ✅ Deploy Concluído com Sucesso!           ║"
    log "${BLUE}" "╚════════════════════════════════════════════════════════╝"
    log "" ""
    log "${MAGENTA}" "🧪 Para testar a conexão, execute:"
    log "${YELLOW}" "   node test-connect-rds.js"
    log "" ""
else
    log "${YELLOW}" "⚠️  Endpoint ainda não está disponível nos outputs"
    log "${CYAN}" "   O RDS pode ainda estar sendo criado"
    log "${CYAN}" "   Aguarde alguns minutos e execute:"
    log "${YELLOW}" "   aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs'"
    log "" ""
fi

log "${GREEN}" "✅ Script finalizado!"
exit 0
