# Estúdio Clubinho — produção de lições

O Estúdio Clubinho é um fluxo administrativo autenticado para produzir um pacote de oito itens: lição, visuais da história, brincadeira, visuais e fixação do versículo, meditações para duas faixas etárias e trabalho manual.

O acervo histórico em `../lições` é referência de formato, não uma fonte automaticamente confiável. Arquivos políticos, nomes de voluntários, variantes de corte, rascunhos, erros ortográficos e citações não conferidas nunca são copiados. Cada etapa gera um único produto canônico; imposições de impressão são responsabilidade do renderer.

O número da semana, o tema e todas as referências bíblicas são obrigatórios na criação. A geração da lição deve preservar literalmente o campo de referências, definir um único versículo principal NVI e produzir IDs de cena únicos no formato `scene-01`. Os visuais posteriores só podem usar esses IDs aprovados.

Prompts personalizados são anexados ao prompt-base da etapa. Eles nunca substituem as regras editoriais, a segurança infantil, o formato de impressão ou o contrato bíblico.

## Máquina de estados

Uma lição percorre `DRAFT`, `IN_PROGRESS`, `PACKAGE_READY`, `IN_REVIEW`, `CHANGES_REQUESTED`, `READY_FOR_PUBLICATION`, `PUBLISHING` e `PUBLISHED`. Cada etapa mantém seu próprio estado e versões imutáveis. Alterar uma etapa invalida as posteriores.

`GET /api/v1/lessons/:id` é leitura pura: nunca cria etapas, atualiza templates ou revoga aprovação. A criação do pacote grava a lição e suas oito etapas numa única transação.

## Listagem

`GET /api/v1/lessons` aceita `status`, `search`, `page`, `limit`, `sort` (`createdAt`, `updatedAt`, `theme`, `weekNumber`) e `order` (`ASC`, `DESC`). Busca considera tema e referência bíblica. A ordenação usa allowlist e desempate por id.

## Publicação idempotente

`POST /api/v1/lessons/:id/publish-week-material` reserva a lição sob lock pessimista, alterando-a de `READY_FOR_PUBLICATION` para `PUBLISHING`. Requisições concorrentes recebem conflito. Após a criação da página semanal, a lição recebe `weekMaterialId` e passa a `PUBLISHED`; chamadas posteriores devolvem o mesmo vínculo sem criar outra página.

Se o provedor falhar antes de criar a página, o estado volta para `READY_FOR_PUBLICATION`. Se a página for criada e a confirmação no banco falhar, a lição permanece em `PUBLISHING` para impedir duplicação e exigir reconciliação operacional.

## Arquivos e privacidade

Uploads de uma geração são rastreados e removidos se qualquer imagem ou persistência posterior falhar. Na exclusão, os registros são removidos antes dos objetos; uma falha de S3 gera órfão auditável em vez de manter registros apontando para arquivos inexistentes.

As respostas usam DTOs públicos. Snapshots de prompt, IDs da OpenAI, checksums, chaves internas e identificadores de autoria não são expostos.
