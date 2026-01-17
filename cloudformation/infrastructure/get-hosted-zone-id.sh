#!/bin/bash

# Script para buscar o HostedZoneId de um domínio no Route53
# Uso: ./get-hosted-zone-id.sh <domain>
# Exemplo: ./get-hosted-zone-id.sh clubinhonib.com

set -e

# Profile AWS (pode ser sobrescrito com variável de ambiente)
AWS_PROFILE=${AWS_PROFILE:-clubinho-aws}

DOMAIN=$1

if [ -z "$DOMAIN" ]; then
    echo "Uso: $0 <domain>"
    echo "Exemplo: $0 clubinhonib.com"
    exit 1
fi

echo "🔍 Buscando HostedZoneId para o domínio: $DOMAIN"
echo "📋 Usando AWS Profile: $AWS_PROFILE"
echo ""

# Buscar HostedZoneId
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
    --profile "$AWS_PROFILE" \
    --query "HostedZones[?Name=='${DOMAIN}.'].[Id]" \
    --output text 2>/dev/null | sed 's|/hostedzone/||' || echo "")

if [ -z "$HOSTED_ZONE_ID" ]; then
    echo "❌ Erro: Hosted Zone não encontrada para o domínio $DOMAIN"
    echo ""
    echo "💡 Listando todas as Hosted Zones disponíveis:"
    aws route53 list-hosted-zones \
        --profile "$AWS_PROFILE" \
        --query 'HostedZones[*].[Name,Id]' \
        --output table
    exit 1
fi

echo "✅ HostedZoneId encontrado: $HOSTED_ZONE_ID"
echo ""
echo "📋 Use este valor no parâmetro HostedZoneId do arquivo de parâmetros:"
echo "   params.json"
echo ""
echo "   \"ParameterKey\": \"HostedZoneId\","
echo "   \"ParameterValue\": \"$HOSTED_ZONE_ID\""
