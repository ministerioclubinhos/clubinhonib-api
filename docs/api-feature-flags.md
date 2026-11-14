# Feature Flags

**Base URL**: `/feature-flags`

Cada flag liga ou desliga um recurso do produto sem novo deploy, e declara
**quem a enxerga**. A decisão de mostrar ou esconder acontece na aplicação: o
back apenas informa, por `/feature-flags/map`, o que vale para a sessão de quem
perguntou.

## Uma flag por recurso

A chave nomeia o **recurso**, nunca o perfil. Quem enxerga cada recurso é
decidido por `targetRoles`, no painel.

Houve um tempo em que a Área das Crianças tinha duas flags, uma por perfil:
dois interruptores para a mesma tela, e a mesma pergunta respondida em dois
lugares. Hoje é uma só, `children_area`, e o perfil sai da audiência.

| Chave | Recurso |
| --- | --- |
| `children_area` | Consulta das crianças e das pagelas |
| `club_photo_upload` | Envio de fotos do clubinho |
| `weekly_materials` | Lista de materiais da visita semanal |
| `site_feedback` | Formulário de avaliação do site |
| `idea_submission` | Envio de uma ideia para a fila |
| `ideas_sharing` | Galeria das ideias já publicadas |
| `events_section` | Página de eventos e seus atalhos |
| `clubinho_feed` | Feed de fotos dos clubinhos |
| `statistics` | Painel de estatísticas |
| `club_control` | Controle operacional dos clubinhos |
| `club_weekly_summary` | Resumo semanal dos clubinhos (a tela que o e-mail de segunda abre) |
| `pagelas` | Gestão das pagelas no painel |

### Chaves aposentadas

As chaves que nomeavam o perfil (`teacher_*`, `coordinator_*`, `admin_*`), as
`shelter-*` e `email_coordinator_weekly_summary` — nome antigo de
`email_weekly_club_summary`, de quando a chave dizia quem recebia em vez do que
o e-mail é — foram aposentadas: elas são removidas do banco no boot e não devem
voltar. Recriar uma delas no painel não adianta — o próximo boot a remove de
novo. Flags criadas pela administração com outros nomes não são tocadas.

A chave aceita apenas minúsculas, números e `_`; o hífen fica de fora para que
a mesma flag não circule escrita de dois jeitos. Ela **pode ser renomeada**, e
a API recusa uma chave já usada — mas renomear uma flag que o código consulta
desliga o recurso na tela até o código apontar para a chave nova.

## Público de uma flag

`targetRoles` é a fonte da verdade; `audience` é o nome da combinação, devolvido
junto para que as duas pontas falem a mesma língua.

| `audience` | `targetRoles` | Quem enxerga |
| --- | --- | --- |
| `EVERYONE` | `[]` | Qualquer pessoa, inclusive sem login |
| `ALL_ROLES` | `admin`, `coordinator`, `teacher` | Qualquer perfil logado |
| `ADMIN` | `admin` | Só administradores |
| `COORDINATOR` | `coordinator` | Só coordenadores |
| `TEACHER` | `teacher` | Só professores |
| `ADMIN_COORDINATOR` | `admin`, `coordinator` | Administradores e coordenadores |
| `ADMIN_TEACHER` | `admin`, `teacher` | Administradores e professores |
| `COORDINATOR_TEACHER` | `coordinator`, `teacher` | Coordenadores e professores |

`EVERYONE` e `ALL_ROLES` **não** são a mesma coisa: sem perfil alvo a flag vale
para o visitante; com os três perfis, ela exige uma sessão.

Uma flag desligada (`enabled: false`) não vale para ninguém, nem para o perfil
alvo.

Os perfis são gravados normalizados — sem espaços, em minúsculas, sem
repetições e sempre na mesma ordem. É isso que permite comparar duas
combinações; flags antigas guardavam a lista em `metadata`, e a leitura ainda
cai para lá quando a coluna está vazia.

## Rotas

| Rota | Quem acessa | O que faz |
| --- | --- | --- |
| `GET /feature-flags` | admin | Listagem paginada do painel |
| `GET /feature-flags/stats` | admin | Resumo: total, ligadas, desligadas e a distribuição por público |
| `GET /feature-flags/map` | qualquer um | `{ chave: vale }` para a sessão de quem pediu |
| `GET /feature-flags/check/:key` | qualquer um | O mesmo, para uma chave só |
| `GET /feature-flags/:key` | admin | Uma flag |
| `POST /feature-flags` | admin | Cria |
| `POST /feature-flags/seed` | admin | Confere o catálogo: cria as de fábrica que faltam e apaga as aposentadas |
| `PATCH /feature-flags/:key` | admin | Edita (parcial) |
| `PATCH /feature-flags/:key/toggle` | admin | Liga/desliga sem mexer no resto |
| `DELETE /feature-flags/:key` | admin | Remove (`204`) |

**Query de `GET /`:** `page`, `limit` (máx. 100), `searchString` (chave, nome
ou descrição), `enabled`, `audience`, `sort` (`name` | `key` | `createdAt` |
`updatedAt`) e `order`.

O recorte por `audience` é aplicado sobre os perfis já normalizados, e não em
SQL: a coluna é JSON e guarda listas fora de ordem e com grafias antigas.

## Contrato (`FeatureFlagResponseDto`)

```jsonc
{
  "id": "uuid",
  "key": "statistics",
  "name": "Estatísticas",
  "description": "Painel de métricas",
  "enabled": true,
  "targetRoles": ["admin", "coordinator"],
  "audience": "ADMIN_COORDINATOR",
  "metadata": null,
  "createdAt": "2026-01-10T12:00:00.000Z",
  "updatedAt": "2026-01-11T12:00:00.000Z"
}
```

A chave segue as regras descritas em "Chaves aposentadas": minúsculas, números
e `_`, e pode ser renomeada.

## Regra de perfil × feature flag

São duas condições diferentes, e usar um recurso exige as duas:

```
pode usar = regra de perfil (código) E flag ligada para o perfil (painel)
```

- **Regra de perfil** é regra de negócio: quem o sistema permite usar o
  recurso. Mora no código — guards de papel da API (`AdminRoleGuard`,
  `AdminOrLeaderRoleGuard`) e `ProtectedRoute requiredRole` no front — e não
  muda pelo painel.
- **Feature flag** liga ou desliga o recurso sem deploy e, por `targetRoles`,
  escolhe para quem dentro da regra ele está ligado.

O público da flag só **restringe**: marcar "Para todos" na flag das
Estatísticas não abre a tela para o professor, porque a rota e a API continuam
exigindo administrador. Há recursos em que as duas condições se somam de
propósito — o resumo semanal, por exemplo, é permitido a admin e coordenador
pela regra, e a flag de fábrica o liga só para o coordenador.

As flags de e-mail e `idea_ai_enhancement` são lidas pelo sistema, sem sessão
(`isSwitchedOn`): nelas só `enabled` conta, e o público não tem efeito.

O painel mostra a regra de perfil de cada flag ao lado do público e avisa
quando o público escolhido inclui perfis que a regra não aceita.

## Decisões

- **O perfil vem da sessão, nunca da query.** `map` e `check` liam `?role=`, o
  que deixava qualquer pessoa pedir o mapa de um administrador.
- **A listagem completa é do administrador.** Ela descreve a configuração
  inteira do produto, inclusive o que está desligado e para quem.
- **Não há guarda de rota por flag no servidor.** A condição é aplicada no
  front; o back informa e não bloqueia.
- **Uma flag por recurso, nunca uma por perfil.** O perfil já é uma dimensão
  da própria flag.
- **Sem campo de ambiente.** Uma flag vale para a instalação inteira.
