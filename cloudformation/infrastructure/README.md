# Infraestrutura API - Clubinho NIB

Infraestrutura completa: Certificado SSL (ACM), EC2, Application Load Balancer e DNS.

## 📋 Visão Geral

Esta pasta contém toda a infraestrutura da API:
- **ACM Stack** (`acm/stack.yaml`) - Certificado SSL
- **EC2 Stack** (`stack.yaml`) - Instâncias EC2, ALB, DNS

**Importante:** Use o script unificado `deploy-infrastructure.sh` que faz deploy das duas stacks na ordem correta.

## 🚀 Deploy Rápido

```bash
# Deploy completo (ACM + EC2)
bash deploy-infrastructure.sh
```

O script automaticamente:
1. ✅ Faz deploy/update da stack ACM
2. ✅ Obtém o ARN do certificado
3. ✅ Atualiza `params.json` com o ARN
4. ✅ Faz deploy/update da stack EC2

## 📂 Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `deploy-infrastructure.sh` | **Script principal** - Deploy unificado ACM + EC2 |
| `deploy-stack.sh` | Deploy apenas da stack EC2 (manual) |
| `deploy-complete.sh` | Deploy da aplicação (Docker) |
| `stack.yaml` | Template CloudFormation EC2 |
| `params.json` | Parâmetros (valores reais) - **NÃO versionar** |
| `params.example.json` | Exemplo de parâmetros |

## ⚙️ Parâmetros (params.json)

```json
{
  "VpcId": "vpc-xxx",              // VPC AWS
  "SubnetStaging": "subnet-xxx",   // Subnet para staging
  "SubnetProd": "subnet-xxx",      // Subnet para prod
  "HostedZoneId": "Z0XXXX",        // Route53 Hosted Zone
  "DomainName": "example.com",     // Domínio principal
  "SSLCertificateArn": "arn:...",  // Auto-atualizado pelo script
  "AMIId": "ami-xxx",              // Amazon Linux 2023
  "KeyPairName": "your-key",       // Chave SSH
  "InstanceTypeStaging": "t3.micro",
  "InstanceTypeProd": "t3.micro",
  "AWSRegion": "us-east-1",
  "S3BucketName": "your-bucket"
}
```

## 🔗 Dependências

### Obrigatórias (antes do deploy):
- ✅ VPC e Subnets públicas
- ✅ Hosted Zone no Route53
- ✅ Key Pair para SSH

### Gerenciadas automaticamente:
- ✅ Certificado SSL (ACM) - criado pelo script
- ✅ Security Groups - criados pela stack
- ✅ IAM Role/Instance Profile - criados pela stack
- ✅ ALB + Target Groups - criados pela stack
- ✅ Registros DNS - criados pela stack

## 📊 Ordem de Deploy Completa

```bash
# 1. Stacks independentes (em paralelo, se desejar)
cd ../../s3 && bash deploy.sh
cd ../../rds && bash deploy.sh
cd ../../ses && bash deploy.sh
cd ../../ecr && bash deploy.sh

# 2. Infraestrutura (ACM + EC2)
cd ../../infrastructure
bash deploy-infrastructure.sh

# 3. Aplicação
bash deploy-complete.sh staging   # ou production
```

## 🏗️ Recursos Criados

### Stack ACM (clubinho-nib-acm):
- Certificado SSL para `*.clubinhonib.com`
- Validação DNS automática

### Stack EC2 (clubinho-nib-ec2):
- 2 instâncias EC2 (staging + production)
- Application Load Balancer (ALB)
- 2 Target Groups (staging + production)
- HTTP Listener (redirect para HTTPS)
- HTTPS Listener (com regras por host)
- Security Groups (ALB + EC2)
- IAM Role + Instance Profile
- 2 registros DNS Route53:
  - `staging-api.clubinhonib.com`
  - `api.clubinhonib.com`

## 🔧 Comandos Úteis

```bash
# Verificar status das stacks
aws cloudformation describe-stacks \
  --stack-name clubinho-nib-acm \
  --profile clubinho-aws

aws cloudformation describe-stacks \
  --stack-name clubinho-nib-ec2 \
  --profile clubinho-aws

# Ver outputs
aws cloudformation describe-stacks \
  --stack-name clubinho-nib-ec2 \
  --profile clubinho-aws \
  --query 'Stacks[0].Outputs'

# Deletar stacks (ordem inversa)
aws cloudformation delete-stack \
  --stack-name clubinho-nib-ec2 \
  --profile clubinho-aws

aws cloudformation delete-stack \
  --stack-name clubinho-nib-acm \
  --profile clubinho-aws
```

## ⚠️ Notas Importantes

1. **Certificado SSL**: O ARN é automaticamente atualizado no `params.json` pelo script
2. **DNS**: A validação do certificado pode levar alguns minutos
3. **params.json**: Não versionar (está no `.gitignore`)
4. **Ambientes**: A stack é única mas cria recursos para staging E production
5. **Deploy da app**: Usar `deploy-complete.sh` após criar a infraestrutura

## 🆘 Troubleshooting

### Erro: "Certificate not validated"
- Aguarde alguns minutos para validação DNS
- Verifique se o Hosted Zone está correto

### Erro: "Subnet not in VPC"
- Confirme que SubnetStaging e SubnetProd pertencem à VpcId

### Erro: "No updates to be performed"
- Normal - significa que a stack já está atualizada

### Stack em ROLLBACK_COMPLETE
- O script automaticamente deleta e recria
- Verifique os logs de erro: `aws cloudformation describe-stack-events --stack-name clubinho-nib-ec2`
