# Scripts de Seed e Automação - Clubinho NIB

Scripts JavaScript para popular o banco de dados e testar os endpoints da API.

## Pré-requisitos

1. API rodando em `localhost:3000`
2. Usuário `superuser@clubinhonib.com` com senha `Abc@123` deve existir
3. Node.js instalado (v18+)
4. Dependências instaladas: `npm install`

## Como Executar

### Seed Completo (todas as entidades)

```bash
node scripts/run-all-testes.js
```

### Com variáveis personalizadas

```bash
ACADEMIC_YEAR=2025 MIN_CLUBS=15 CHILDREN_PER_CLUB=20 node scripts/run-all-testes.js
```

### Apenas pagelas de um ano específico

```bash
node scripts/create-pagelas-2026.js
```

## Variáveis de Ambiente

| Variável              | Padrão  | Descrição                                            |
|-----------------------|---------|------------------------------------------------------|
| `API_BASE_URL`        | `http://localhost:3000` | URL base da API                        |
| `SUPERUSER_EMAIL`     | `superuser@clubinhonib.com` | Email do superusuário              |
| `SUPERUSER_PASSWORD`  | `Abc@123` | Senha do superusuário                            |
| `ACADEMIC_YEAR`       | ano atual | Ano letivo para períodos e pagelas              |
| `USERS_TO_CREATE`     | `20`    | Número de usuários extras a criar                    |
| `MIN_CLUBS`           | `10`    | Número mínimo de clubes                              |
| `MIN_TEACHERS_PER_CLUB` | `5`   | Professores mínimos por clube                        |
| `CHILDREN_PER_CLUB`   | `15`   | Crianças por clube                                   |
| `WEEKS`               | `0`     | Semanas de pagelas (0 = calcula pelo período letivo) |
| `MIN_PAGES_ITEMS`     | `10`    | Mínimo de itens de conteúdo por tipo                 |
| `PAGELAS_CHILD_LIMIT` | `0`     | Limite de crianças para pagelas (0 = sem limite)     |
| `PAGELAS_DEBUG`       | `false` | Ativa logs detalhados de pagelas                     |
| `PAGELAS_CHILD_ID`    | ``      | Processa apenas uma criança específica               |

## Entidades Populadas

O seed completo alimenta **todas** as entidades do banco:

| # | Entidade              | Descrição                                              |
|---|-----------------------|--------------------------------------------------------|
| 1 | `users`               | Professores (60%), coordenadores (30%), admins (10%)   |
| 2 | `teacher_profiles`    | Perfis de professores vinculados aos usuários          |
| 3 | `coordinator_profiles`| Perfis de coordenadores vinculados aos usuários        |
| 4 | `addresses`           | Endereços de clubes e crianças                         |
| 5 | `clubs`               | Clubes com diversidade de dias da semana               |
| 6 | `children`            | Crianças por clube com dados completos                 |
| 7 | `academic_periods`    | Período letivo global (início/fim do ano)              |
| 8 | `weekday_exceptions`  | Feriados nacionais + exceções do Clubinho              |
| 9 | `pagelas`             | Frequência semanal de cada criança por todo o período  |
| 10| `accepted_christs`    | Decisões de fé (~20-30% das crianças)                  |
| 11| `comments`            | Depoimentos reais de pais sobre o Clubinho             |
| 12| `contacts`            | Formulários de contato com mensagens realistas         |
| 13| `site_feedbacks`      | Feedbacks do site com categorias diversas              |
| 14| `informatives`        | Informativos e avisos do ministério                    |
| 15| `documents`           | Documentos do ministério (manuais, formulários)        |
| 16| `events`              | Eventos anuais (festas, acampamentos, formaturas)      |
| 17| `meditations`         | Meditações semanais com temas e versículos bíblicos    |
| 18| `ideas_pages`         | Páginas de ideias de atividades por tema               |
| 19| `ideas_sections`      | Seções de atividades individuais                       |
| 20| `image_pages`         | Páginas de galerias de fotos                           |
| 21| `image_sections`      | Seções de imagens com múltiplas fotos                  |
| 22| `video_pages`         | Páginas de vídeos (músicas, histórias bíblicas, etc.)  |
| 23| `week_materials_pages`| Material didático semanal (vídeo + documentos)         |
| 24| `routes`              | Rotas geradas automaticamente pelas entidades          |

## Fluxo de Execução

```
1. Auth         → Valida login do superusuário
2. Calendário   → Período letivo + feriados nacionais + exceções
3. Usuários     → Cria professores, coordenadores, admins
4. Perfis       → Vincula perfis aos usuários criados
5. Clubes       → Cria clubes com diversidade de dias da semana
                   ↳ Garante coordenador e professores por clube
6. Crianças     → Cria crianças por clube
7. Pagelas      → Frequência semanal de toda a vigência do ano letivo
8. Aceitações   → Registros de decisão de fé (~20-30% das crianças)
9. Estatísticas → Smoke test dos endpoints de analytics
10. Rotas       → Lista rotas geradas automaticamente
11. Conteúdo    → Comentários, contatos, feedbacks, informativos,
                   documentos, eventos, meditações, páginas de ideias,
                   galerias de fotos, páginas de vídeos, materiais semanais
12. Smoke test  → Verificação final de todos os endpoints GET do site
```

## Estrutura de Arquivos

```
scripts/
├── run-all-testes.js          # Ponto de entrada principal
├── create-pagelas-2026.js     # Script específico para pagelas
└── automations/
    ├── run-all.js             # Orquestrador geral
    ├── logger.js              # Logger compartilhado
    ├── common/
    │   ├── config.js          # Configurações e variáveis de ambiente
    │   ├── http.js            # Cliente HTTP com autenticação
    │   ├── random.js          # Dados aleatórios realistas em português
    │   ├── pagination.js      # Busca paginada automática
    │   ├── multipart.js       # Upload multipart/form-data
    │   └── sleep.js           # Utilitário de delay
    ├── auth/                  # Autenticação
    ├── club-control/          # Período letivo e exceções
    ├── users/                 # Usuários
    ├── teacher-profiles/      # Perfis de professores
    ├── coordinator-profiles/  # Perfis de coordenadores
    ├── clubs/                 # Clubes
    ├── children/              # Crianças
    ├── pagelas/               # Pagelas de frequência
    ├── accepted-christs/      # Decisões de fé
    ├── statistics/            # Smoke test de estatísticas
    ├── routes/                # Rotas
    ├── comments/              # Comentários/depoimentos
    ├── contact/               # Formulários de contato
    ├── site-feedbacks/        # Feedbacks do site
    ├── informatives/          # Informativos
    ├── documents/             # Documentos
    ├── events/                # Eventos
    ├── meditations/           # Meditações semanais
    ├── ideas-pages/           # Páginas de ideias
    ├── ideas-sections/        # Seções de ideias
    ├── image-pages/           # Páginas de galerias
    ├── image-sections/        # Seções de imagens
    ├── video-pages/           # Páginas de vídeos
    ├── week-material-pages/   # Materiais semanais
    └── site-smoke/            # Smoke test final
```

## Notas

- Scripts são idempotentes: podem ser executados múltiplas vezes sem duplicar dados
- Cada módulo tem um `create.js` (cria se não existe) e um `list-fix.js` (verifica/corrige)
- ⚠️ **Atenção**: Cria dados reais no banco. Use com cuidado em produção.
