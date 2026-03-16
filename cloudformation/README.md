# CloudFormation - Clubinhonib API

Templates CloudFormation para provisionar infraestrutura AWS.

## Estrutura de Pastas

```
cloudformation/
│
├── multi-account/              # ✅ ARQUITETURA ATUAL (Multi-Conta)
│   ├── conta-aws/              # Stacks para conta 614946928663
│   │   ├── ecr-stack.yaml      # Repositorio ECR (lifecycle 24h)
│   │   └── infra-stack.yaml    # ALB compartilhado + EC2s
│   ├── clubinho-aws/           # Stacks para conta 697760557838
│   │   └── dns-stack.yaml      # Route53 DNS
│   ├── deploy-complete.sh      # Script de deploy completo
│   └── README.md               # Documentacao detalhada
│
└── legacy/                     # ⚠️ DEPRECATED (stacks antigas)
    ├── ecr/
    ├── rds/
    ├── s3/
    └── ses/
```

---

## Arquitetura Multi-Conta

```
┌─────────────────────────────────────────────────────────┐
│            clubinho-aws (697760557838)                  │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Route53: api.clubinhonib.com → ALB               │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              conta-aws (614946928663)                   │
│  ┌───────────────────────────────────────────────────┐  │
│  │ shared-alb (ALB UNICO)                            │  │
│  │   ├─ Host: api.clubinhonib.com → EC2 App1 :3000  │  │
│  │   └─ Host: api.outra.com → EC2 App2 :3001        │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │ ECR: clubinho-nib-api-production (24h lifecycle) │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Deploy Rapido

```bash
cd cloudformation/multi-account

# Deploy completo (infraestrutura + build + deploy)
./deploy-complete.sh

# Apenas infraestrutura (sem build/deploy)
./deploy-complete.sh --skip-build --skip-deploy

# Apenas aplicacao (infraestrutura ja existe)
./deploy-complete.sh --skip-infra
```

---

## Stacks Ativas

| Stack | Conta | Descricao |
|-------|-------|-----------|
| `ecr-repository` | conta-aws | ECR com lifecycle 24h |
| `shared-infra` | conta-aws | ALB + EC2 (parametrizavel) |
| `api-dns-record` | clubinho-aws | DNS apontando para ALB |

---

## Custos Estimados

| Cenario | Custo/mes |
|---------|-----------|
| 1 aplicacao | ~$25/mes |
| 2 aplicacoes | ~$34/mes |
| 3 aplicacoes | ~$43/mes |

> O ALB e compartilhado! Cada nova app adiciona ~$8.60/mes

---

## Documentacao Detalhada

Veja: [multi-account/README.md](multi-account/README.md)
