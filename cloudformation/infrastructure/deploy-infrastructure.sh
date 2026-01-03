#!/bin/bash

# Script unificado para deploy de ACM + EC2
# Faz deploy do certificado SSL primeiro, depois da infraestrutura EC2
# Uso: ./deploy-infrastructure.sh

set -e

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Profile AWS
AWS_PROFILE=${AWS_PROFILE:-clubinho-aws}

# Diretórios e arquivos
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Arquivos ACM
ACM_TEMPLATE="$SCRIPT_DIR/acm-stack.yaml"
ACM_PARAMS="$SCRIPT_DIR/acm-params.json"

# Arquivos EC2
EC2_TEMPLATE="$SCRIPT_DIR/ec2-stack.yaml"
EC2_PARAMS="$SCRIPT_DIR/ec2-params.json"

echo -e "${MAGENTA}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}║   🚀 Deploy Infraestrutura - ACM + EC2                ║${NC}"
echo -e "${MAGENTA}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================================
# VALIDAÇÃO DE PRÉ-REQUISITOS
# ============================================================================

echo -e "${BLUE}🔍 Validando pré-requisitos...${NC}"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI não instalado${NC}"
    exit 1
fi

# Check Python3
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python3 não instalado (necessário para manipulação JSON)${NC}"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity --profile "$AWS_PROFILE" &> /dev/null; then
    echo -e "${RED}❌ Credenciais AWS não configuradas para profile: $AWS_PROFILE${NC}"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --profile "$AWS_PROFILE" --query 'Account' --output text)
echo -e "${GREEN}✅ AWS CLI configurado (Account: $ACCOUNT_ID)${NC}"
echo -e "${GREEN}✅ Python3 disponível${NC}"
echo -e "${CYAN}📋 AWS Profile: ${AWS_PROFILE}${NC}"
echo ""

# Nomes das stacks
ACM_STACK_NAME="clubinho-nib-acm"
EC2_STACK_NAME="clubinho-nib-ec2"

# ============================================================================
# FUNÇÕES AUXILIARES
# ============================================================================

get_stack_status() {
    local stack_name=$1
    aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --profile "$AWS_PROFILE" \
        --query 'Stacks[0].StackStatus' \
        --output text 2>/dev/null || echo "NOT_FOUND"
}

wait_for_stack() {
    local stack_name=$1
    local target_statuses=$2
    local timeout=${3:-600}
    local elapsed=0

    echo -e "${CYAN}⏳ Aguardando stack $stack_name atingir status: $target_statuses${NC}"

    while [ $elapsed -lt $timeout ]; do
        local status=$(get_stack_status "$stack_name")

        # Verificar se atingiu algum dos estados alvo
        for target in $(echo "$target_statuses" | tr '|' ' '); do
            if [ "$status" = "$target" ]; then
                echo -e "${GREEN}✅ Stack atingiu status: $status${NC}"
                return 0
            fi
        done

        case "$status" in
            ROLLBACK_COMPLETE)
                echo -e "${YELLOW}⚠️  Stack em estado ROLLBACK_COMPLETE (não pode ser atualizada)${NC}"
                return 2  # Código especial para indicar que precisa deletar
                ;;
            CREATE_FAILED|UPDATE_FAILED|DELETE_FAILED)
                echo -e "${RED}❌ Stack falhou com status: $status${NC}"
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
                sleep 10
                elapsed=$((elapsed + 10))
                ;;
        esac
    done

    echo -e "${RED}❌ Timeout aguardando stack${NC}"
    return 1
}

delete_stack() {
    local stack_name=$1
    local status=$(get_stack_status "$stack_name")

    if [ "$status" = "NOT_FOUND" ] || [ "$status" = "DELETE_COMPLETE" ]; then
        echo -e "${GREEN}✅ Stack $stack_name já está deletada${NC}"
        return 0
    fi

    echo -e "${YELLOW}🗑️  Deletando stack $stack_name...${NC}"
    aws cloudformation delete-stack --stack-name "$stack_name" --profile "$AWS_PROFILE" 2>/dev/null

    if wait_for_stack "$stack_name" "DELETE_COMPLETE|NOT_FOUND" 600; then
        echo -e "${GREEN}✅ Stack deletada com sucesso${NC}"
        return 0
    else
        echo -e "${RED}❌ Erro ao deletar stack${NC}"
        return 1
    fi
}

# ============================================================================
# PASSO 1: VERIFICAR/DEPLOY DO CERTIFICADO SSL (ACM)
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 PASSO 1: Verificar/Deploy do Certificado SSL (ACM)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Verificar se já existe certificado válido para o domínio
echo -e "${CYAN}🔍 Verificando certificados ACM existentes...${NC}"
EXISTING_CERT=$(aws acm list-certificates \
    --profile "$AWS_PROFILE" \
    --query "CertificateSummaryList[?DomainName=='clubinhonib.com'].CertificateArn" \
    --output text 2>/dev/null || echo "")

if [ -n "$EXISTING_CERT" ]; then
    # Verificar status do certificado existente
    CERT_STATUS_CHECK=$(aws acm describe-certificate \
        --certificate-arn "$EXISTING_CERT" \
        --profile "$AWS_PROFILE" \
        --query 'Certificate.Status' \
        --output text 2>/dev/null || echo "")

    if [ "$CERT_STATUS_CHECK" = "ISSUED" ]; then
        echo -e "${GREEN}✅ Certificado válido já existe!${NC}"
        echo -e "${CYAN}   ARN: ${EXISTING_CERT}${NC}"
        echo -e "${CYAN}   Status: ISSUED${NC}"
        echo -e "${YELLOW}⏭️  Pulando criação de nova stack ACM${NC}"
        CERT_ARN="$EXISTING_CERT"
        SKIP_ACM_CREATION=true
    else
        echo -e "${YELLOW}⚠️  Certificado existe mas status: ${CERT_STATUS_CHECK}${NC}"
        SKIP_ACM_CREATION=false
    fi
else
    echo -e "${CYAN}📋 Nenhum certificado encontrado para clubinhonib.com${NC}"
    SKIP_ACM_CREATION=false
fi

# Se não tiver certificado válido, criar stack ACM
if [ "$SKIP_ACM_CREATION" != "true" ]; then
    echo ""
    echo -e "${BLUE}📦 Criando/Atualizando stack ACM...${NC}"

    # Verificar arquivos ACM
    if [ ! -f "$ACM_TEMPLATE" ] || [ ! -f "$ACM_PARAMS" ]; then
        echo -e "${RED}❌ Erro: Arquivos ACM não encontrados${NC}"
        echo -e "${RED}   Template: $ACM_TEMPLATE${NC}"
        echo -e "${RED}   Params: $ACM_PARAMS${NC}"
        exit 1
    fi

    ACM_STATUS=$(get_stack_status "$ACM_STACK_NAME")
    echo -e "${CYAN}🔍 Status da stack ACM: ${ACM_STATUS}${NC}"

case "$ACM_STATUS" in
    NOT_FOUND)
        echo -e "${GREEN}📦 Criando nova stack ACM...${NC}"
        aws cloudformation create-stack \
            --stack-name "$ACM_STACK_NAME" \
            --template-body file://"$ACM_TEMPLATE" \
            --parameters file://"$ACM_PARAMS" \
            --profile "$AWS_PROFILE" \
            --capabilities CAPABILITY_NAMED_IAM

        wait_for_stack "$ACM_STACK_NAME" "CREATE_COMPLETE" 600
        wait_result=$?

        if [ $wait_result -eq 0 ]; then
            echo -e "${GREEN}✅ Stack ACM criada com sucesso!${NC}"
        elif [ $wait_result -eq 2 ]; then
            # ROLLBACK_COMPLETE detectado, deletar e recriar
            echo -e "${YELLOW}🔄 Stack falhou, deletando e recriando...${NC}"
            delete_stack "$ACM_STACK_NAME"
            aws cloudformation create-stack \
                --stack-name "$ACM_STACK_NAME" \
                --template-body file://"$ACM_TEMPLATE" \
                --parameters file://"$ACM_PARAMS" \
                --profile "$AWS_PROFILE" \
                --capabilities CAPABILITY_NAMED_IAM
            wait_for_stack "$ACM_STACK_NAME" "CREATE_COMPLETE" 600
        else
            echo -e "${RED}❌ Erro ao criar stack ACM${NC}"
            exit 1
        fi
        ;;
    CREATE_COMPLETE|UPDATE_COMPLETE)
        echo -e "${GREEN}✅ Stack ACM já existe${NC}"
        echo -e "${BLUE}🔄 Atualizando stack ACM...${NC}"

        update_output=$(aws cloudformation update-stack \
            --stack-name "$ACM_STACK_NAME" \
            --template-body file://"$ACM_TEMPLATE" \
            --parameters file://"$ACM_PARAMS" \
            --profile "$AWS_PROFILE" \
            --capabilities CAPABILITY_NAMED_IAM 2>&1) || true

        if echo "$update_output" | grep -q "No updates are to be performed"; then
            echo -e "${GREEN}✅ Nenhuma atualização necessária${NC}"
        elif echo "$update_output" | grep -q "StackId"; then
            wait_for_stack "$ACM_STACK_NAME" "UPDATE_COMPLETE" 600
            wait_result=$?

            if [ $wait_result -eq 0 ]; then
                echo -e "${GREEN}✅ Stack ACM atualizada!${NC}"
            elif [ $wait_result -eq 2 ]; then
                # ROLLBACK_COMPLETE detectado, deletar e recriar
                echo -e "${YELLOW}🔄 Update falhou, deletando e recriando...${NC}"
                delete_stack "$ACM_STACK_NAME"
                aws cloudformation create-stack \
                    --stack-name "$ACM_STACK_NAME" \
                    --template-body file://"$ACM_TEMPLATE" \
                    --parameters file://"$ACM_PARAMS" \
                    --profile "$AWS_PROFILE" \
                    --capabilities CAPABILITY_NAMED_IAM
                wait_for_stack "$ACM_STACK_NAME" "CREATE_COMPLETE" 600
            else
                echo -e "${RED}❌ Erro ao atualizar stack ACM${NC}"
                exit 1
            fi
        else
            echo -e "${YELLOW}⚠️  Status desconhecido, continuando...${NC}"
        fi
        ;;
    ROLLBACK_COMPLETE|DELETE_COMPLETE)
        echo -e "${YELLOW}⚠️  Stack em estado inválido ($ACM_STATUS), deletando e recriando...${NC}"
        if delete_stack "$ACM_STACK_NAME"; then
            echo -e "${GREEN}📦 Recriando stack ACM...${NC}"
            aws cloudformation create-stack \
                --stack-name "$ACM_STACK_NAME" \
                --template-body file://"$ACM_TEMPLATE" \
                --parameters file://"$ACM_PARAMS" \
                --profile "$AWS_PROFILE" \
                --capabilities CAPABILITY_NAMED_IAM

            wait_for_stack "$ACM_STACK_NAME" "CREATE_COMPLETE" 600
        fi
        ;;
    *)
        echo -e "${YELLOW}⚠️  Status atual: $ACM_STATUS, aguardando...${NC}"
        wait_for_stack "$ACM_STACK_NAME" "CREATE_COMPLETE|UPDATE_COMPLETE" 600
        ;;
esac

    echo ""
    echo -e "${CYAN}🔍 Obtendo ARN do certificado da stack...${NC}"
    CERT_ARN=$(aws cloudformation describe-stacks \
        --stack-name "$ACM_STACK_NAME" \
        --profile "$AWS_PROFILE" \
        --query 'Stacks[0].Outputs[?OutputKey==`CertificateArn`].OutputValue' \
        --output text 2>/dev/null || echo "")

    if [ -z "$CERT_ARN" ] || [ "$CERT_ARN" = "None" ]; then
        echo -e "${RED}❌ Erro: Não foi possível obter o ARN do certificado da stack${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Certificado ARN obtido da stack: ${CERT_ARN}${NC}"
fi

echo ""
echo -e "${GREEN}✅ Certificado SSL pronto: ${CERT_ARN}${NC}"
echo ""

# ============================================================================
# PASSO 2: VALIDAR CERTIFICADO SSL
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔒 PASSO 2: Validando Certificado SSL${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${CYAN}🔍 Verificando status do certificado...${NC}"

# Verificar status atual
CERT_STATUS=$(aws acm describe-certificate \
    --certificate-arn "$CERT_ARN" \
    --profile "$AWS_PROFILE" \
    --query 'Certificate.Status' \
    --output text)

if [ "$CERT_STATUS" = "ISSUED" ]; then
    echo -e "${GREEN}✅ Certificado já está validado e emitido!${NC}"
    echo ""
else
    # Se não estiver ISSUED, aguardar validação
    echo -e "${YELLOW}⏳ Status atual: $CERT_STATUS${NC}"
    echo -e "${CYAN}Aguardando validação DNS...${NC}"

    MAX_RETRIES=60
    RETRY_COUNT=0
    SLEEP_TIME=10

    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        CERT_STATUS=$(aws acm describe-certificate \
            --certificate-arn "$CERT_ARN" \
            --profile "$AWS_PROFILE" \
            --query 'Certificate.Status' \
            --output text)

        if [ "$CERT_STATUS" = "ISSUED" ]; then
            echo -e "${GREEN}✅ Certificado validado e emitido com sucesso!${NC}"
            echo ""
            break
        elif [ "$CERT_STATUS" = "PENDING_VALIDATION" ]; then
            RETRY_COUNT=$((RETRY_COUNT + 1))
            MINUTES=$((RETRY_COUNT * SLEEP_TIME / 60))
            echo -ne "\r${CYAN}⏳ Aguardando validação DNS... (tentativa $RETRY_COUNT/$MAX_RETRIES - ${MINUTES}m)${NC}   "
            sleep $SLEEP_TIME
        else
            echo -e "${RED}❌ Status inesperado do certificado: $CERT_STATUS${NC}"
            exit 1
        fi
    done

    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo -e "${RED}❌ Timeout aguardando validação do certificado (${MAX_RETRIES} tentativas)${NC}"
        echo -e "${YELLOW}⚠️  Verifique os registros DNS no Route53 e tente novamente${NC}"
        exit 1
    fi
fi

# ============================================================================
# PASSO 3: ATUALIZAR PARAMS.JSON DO EC2 COM O ARN DO CERTIFICADO
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔧 PASSO 3: Atualizando ec2-params.json com ARN do certificado${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Atualizar ec2-params.json com o ARN do certificado
python3 - <<PYTHON
import json

# Ler params.json
with open("$EC2_PARAMS", 'r') as f:
    params = json.load(f)

# Atualizar SSLCertificateArn
for param in params:
    if param['ParameterKey'] == 'SSLCertificateArn':
        param['ParameterValue'] = "$CERT_ARN"
        break

# Salvar
with open("$EC2_PARAMS", 'w') as f:
    json.dump(params, f, indent=2)
PYTHON

echo -e "${GREEN}✅ params.json atualizado com ARN do certificado${NC}"
echo ""

# ============================================================================
# PASSO 4: DEPLOY DA STACK EC2
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🚀 PASSO 4: Deploy da Stack EC2${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

EC2_STATUS=$(get_stack_status "$EC2_STACK_NAME")
echo -e "${CYAN}🔍 Status da stack EC2: ${EC2_STATUS}${NC}"

case "$EC2_STATUS" in
    NOT_FOUND)
        echo -e "${GREEN}📦 Criando nova stack EC2...${NC}"
        aws cloudformation create-stack \
            --stack-name "$EC2_STACK_NAME" \
            --template-body file://"$EC2_TEMPLATE" \
            --parameters file://"$EC2_PARAMS" \
            --capabilities CAPABILITY_NAMED_IAM \
            --profile "$AWS_PROFILE"

        wait_for_stack "$EC2_STACK_NAME" "CREATE_COMPLETE" 900
        wait_result=$?

        if [ $wait_result -eq 0 ]; then
            echo -e "${GREEN}✅ Stack EC2 criada com sucesso!${NC}"
        elif [ $wait_result -eq 2 ]; then
            # ROLLBACK_COMPLETE detectado, deletar e recriar
            echo -e "${YELLOW}🔄 Stack falhou, deletando e recriando...${NC}"
            delete_stack "$EC2_STACK_NAME"
            aws cloudformation create-stack \
                --stack-name "$EC2_STACK_NAME" \
                --template-body file://"$EC2_TEMPLATE" \
                --parameters file://"$EC2_PARAMS" \
                --capabilities CAPABILITY_NAMED_IAM \
                --profile "$AWS_PROFILE"
            wait_for_stack "$EC2_STACK_NAME" "CREATE_COMPLETE" 900
        else
            echo -e "${RED}❌ Erro ao criar stack EC2${NC}"
            exit 1
        fi
        ;;
    CREATE_COMPLETE|UPDATE_COMPLETE)
        echo -e "${GREEN}✅ Stack EC2 já existe${NC}"
        echo -e "${BLUE}🔄 Atualizando stack EC2...${NC}"

        update_output=$(aws cloudformation update-stack \
            --stack-name "$EC2_STACK_NAME" \
            --template-body file://"$EC2_TEMPLATE" \
            --parameters file://"$EC2_PARAMS" \
            --capabilities CAPABILITY_NAMED_IAM \
            --profile "$AWS_PROFILE" 2>&1) || true

        if echo "$update_output" | grep -q "No updates are to be performed"; then
            echo -e "${GREEN}✅ Nenhuma atualização necessária${NC}"
        elif echo "$update_output" | grep -q "StackId"; then
            wait_for_stack "$EC2_STACK_NAME" "UPDATE_COMPLETE" 900
            wait_result=$?

            if [ $wait_result -eq 0 ]; then
                echo -e "${GREEN}✅ Stack EC2 atualizada!${NC}"
            elif [ $wait_result -eq 2 ]; then
                # ROLLBACK_COMPLETE detectado, deletar e recriar
                echo -e "${YELLOW}🔄 Update falhou, deletando e recriando...${NC}"
                delete_stack "$EC2_STACK_NAME"
                aws cloudformation create-stack \
                    --stack-name "$EC2_STACK_NAME" \
                    --template-body file://"$EC2_TEMPLATE" \
                    --parameters file://"$EC2_PARAMS" \
                    --capabilities CAPABILITY_NAMED_IAM \
                    --profile "$AWS_PROFILE"
                wait_for_stack "$EC2_STACK_NAME" "CREATE_COMPLETE" 900
            else
                echo -e "${RED}❌ Erro ao atualizar stack EC2${NC}"
                exit 1
            fi
        else
            echo -e "${YELLOW}⚠️  Status desconhecido, continuando...${NC}"
        fi
        ;;
    ROLLBACK_COMPLETE|DELETE_COMPLETE)
        echo -e "${YELLOW}⚠️  Stack em estado inválido ($EC2_STATUS), deletando e recriando...${NC}"
        if delete_stack "$EC2_STACK_NAME"; then
            echo -e "${GREEN}📦 Recriando stack EC2...${NC}"
            aws cloudformation create-stack \
                --stack-name "$EC2_STACK_NAME" \
                --template-body file://"$EC2_TEMPLATE" \
                --parameters file://"$EC2_PARAMS" \
                --capabilities CAPABILITY_NAMED_IAM \
                --profile "$AWS_PROFILE"

            wait_for_stack "$EC2_STACK_NAME" "CREATE_COMPLETE" 900
        fi
        ;;
    *)
        echo -e "${YELLOW}⚠️  Status atual: $EC2_STATUS, aguardando...${NC}"
        wait_for_stack "$EC2_STACK_NAME" "CREATE_COMPLETE|UPDATE_COMPLETE" 900
        ;;
esac

# ============================================================================
# PASSO 5: VALIDAÇÃO FINAL DA INFRAESTRUTURA
# ============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍 PASSO 5: Validando Infraestrutura${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Get EC2 instance IDs
STAGING_INSTANCE_ID=$(aws cloudformation describe-stacks \
    --stack-name "$EC2_STACK_NAME" \
    --profile "$AWS_PROFILE" \
    --query 'Stacks[0].Outputs[?OutputKey==`InstanceIdStaging`].OutputValue' \
    --output text 2>/dev/null || echo "")

PROD_INSTANCE_ID=$(aws cloudformation describe-stacks \
    --stack-name "$EC2_STACK_NAME" \
    --profile "$AWS_PROFILE" \
    --query 'Stacks[0].Outputs[?OutputKey==`InstanceIdProd`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -n "$STAGING_INSTANCE_ID" ]; then
    STAGING_STATE=$(aws ec2 describe-instances \
        --instance-ids "$STAGING_INSTANCE_ID" \
        --profile "$AWS_PROFILE" \
        --query 'Reservations[0].Instances[0].State.Name' \
        --output text)
    echo -e "${CYAN}   Staging Instance ($STAGING_INSTANCE_ID): $STAGING_STATE${NC}"
fi

if [ -n "$PROD_INSTANCE_ID" ]; then
    PROD_STATE=$(aws ec2 describe-instances \
        --instance-ids "$PROD_INSTANCE_ID" \
        --profile "$AWS_PROFILE" \
        --query 'Reservations[0].Instances[0].State.Name' \
        --output text)
    echo -e "${CYAN}   Production Instance ($PROD_INSTANCE_ID): $PROD_STATE${NC}"
fi

# Get ALB DNS
ALB_DNS=$(aws cloudformation describe-stacks \
    --stack-name "$EC2_STACK_NAME" \
    --profile "$AWS_PROFILE" \
    --query 'Stacks[0].Outputs[?OutputKey==`ALBDNS`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -n "$ALB_DNS" ]; then
    echo -e "${GREEN}   ✅ Load Balancer: $ALB_DNS${NC}"
fi

# Get application URLs from stack outputs
STAGING_URL=$(aws cloudformation describe-stacks \
    --stack-name "$EC2_STACK_NAME" \
    --profile "$AWS_PROFILE" \
    --query 'Stacks[0].Outputs[?OutputKey==`StagingURL`].OutputValue' \
    --output text 2>/dev/null || echo "")

PROD_URL=$(aws cloudformation describe-stacks \
    --stack-name "$EC2_STACK_NAME" \
    --profile "$AWS_PROFILE" \
    --query 'Stacks[0].Outputs[?OutputKey==`ProdURL`].OutputValue' \
    --output text 2>/dev/null || echo "")

echo ""
if [ -n "$STAGING_URL" ]; then
    echo -e "${GREEN}   ✅ Staging URL: $STAGING_URL${NC}"
fi

if [ -n "$PROD_URL" ]; then
    echo -e "${GREEN}   ✅ Production URL: $PROD_URL${NC}"
fi

echo ""
echo -e "${GREEN}✅ Validação da infraestrutura completa${NC}"
echo -e "${CYAN}ℹ️  Ambas as instâncias (Staging + Production) foram criadas no mesmo deploy${NC}"

# ============================================================================
# RESUMO FINAL
# ============================================================================

echo ""
echo -e "${MAGENTA}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}║          ✅ Deploy de Infraestrutura Completo!         ║${NC}"
echo -e "${MAGENTA}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${GREEN}📋 Resumo:${NC}"
echo -e "${CYAN}   ✅ Stack ACM: ${ACM_STACK_NAME}${NC}"
echo -e "${CYAN}   ✅ Stack EC2: ${EC2_STACK_NAME}${NC}"
echo -e "${CYAN}   ✅ Certificado: ${CERT_ARN}${NC}"
echo -e "${CYAN}   ✅ Instâncias: Staging + Production (criadas simultaneamente)${NC}"
echo ""

echo -e "${YELLOW}🌐 URLs da API:${NC}"
echo -e "${CYAN}   Staging: https://staging-api.clubinhonib.com${NC}"
echo -e "${CYAN}   Production: https://api.clubinhonib.com${NC}"
echo ""

echo -e "${BLUE}💡 Próximo passo - Deploy da aplicação:${NC}"
echo -e "${CYAN}   Para Staging:${NC}"
echo -e "${CYAN}   cd $SCRIPT_DIR && bash deploy-complete.sh staging${NC}"
echo ""
echo -e "${CYAN}   Para Production:${NC}"
echo -e "${CYAN}   cd $SCRIPT_DIR && bash deploy-complete.sh prod${NC}"
echo ""
echo -e "${YELLOW}ℹ️  Nota: Ambas as instâncias estão prontas. Você pode fazer deploy em qualquer uma.${NC}"
echo ""
