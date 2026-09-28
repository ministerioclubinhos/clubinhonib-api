# Estúdio Clubinho — produção de lições

O Estúdio Clubinho é um fluxo administrativo autenticado para produzir um pacote de oito itens: lição, visuais da história, brincadeira, visuais e fixação do versículo, meditações para duas faixas etárias e trabalho manual.

O acervo histórico em `../lições` é referência de formato, não uma fonte automaticamente confiável. Arquivos políticos, nomes de voluntários, variantes de corte, rascunhos, erros ortográficos e citações não conferidas nunca são copiados. Cada etapa gera um único produto canônico; imposições de impressão são responsabilidade do renderer.

O número da semana, o tema e todas as referências bíblicas são obrigatórios na criação. A geração da lição deve preservar literalmente o campo de referências, definir um único versículo principal NVI e produzir IDs de cena únicos no formato `scene-01`. Os visuais posteriores só podem usar esses IDs aprovados.

Os visuais da história usam como fonte canônica o conteúdo completo do tópico `LIÇÃO BÍBLICA` da versão atual da primeira etapa. O administrador informa uma quantidade inteira de 4 a 10 imagens: a LLM divide integralmente a narrativa nessa quantidade exata de trechos literais, contínuos e consecutivos, sem omitir, repetir ou reescrever conteúdo. Cada trecho e a história completa são incluídos no prompt final de sua imagem; personagens, ações, objetos, ambientes ou emoções ausentes dessa fonte não podem ser acrescentados. Quando a lição é editada no editor, o tópico estruturado é sincronizado antes de uma geração posterior.

A primeira cena gerada estabelece a identidade visual da sequência. Todas as cenas seguintes recebem essa mesma imagem-mãe como referência, além da história completa e de sua própria cena aprovada. A referência não é encadeada entre cenas: todas partem da primeira imagem para evitar deriva acumulativa de personagens, roupas, traço, paleta, iluminação e ambientes.

Na brincadeira, cada item do passo a passo possui exatamente um visual instrucional na mesma ordem. O prompt de imagem recebe a brincadeira completa e a instrução literal do passo, devendo demonstrar sua execução; imagens decorativas sem função de instrução são rejeitadas pelo contrato estruturado. O preview PDF da etapa imprime o número e a instrução do passo acima da imagem correspondente. Instrução e imagem formam um bloco indivisível para nunca serem separadas pela paginação.

Prompts personalizados são anexados ao prompt-base da etapa. Eles nunca substituem as regras editoriais, a segurança infantil, o formato de impressão ou o contrato bíblico.

## Provedor de IA

O Estúdio consome um contrato neutro de LLM para texto estruturado e imagens. A variável `LLM_PROVIDER` seleciona `openai` (padrão compatível com instalações existentes) ou `gemini` para toda a geração de um processo. Não existe fallback silencioso entre provedores: ausência de chave ou falha externa interrompe a etapa e a marca como falha.

- OpenAI: `OPENAI_API_KEY`, `OPENAI_TEXT_MODEL` e `OPENAI_IMAGE_MODEL`.
- Gemini: `GEMINI_API_KEY`, `GEMINI_TEXT_MODEL`, `GEMINI_TEXT_FALLBACK_MODEL`, `GEMINI_IMAGE_MODEL`, `GEMINI_IMAGE_SIZE`, `GEMINI_MAX_RETRIES` e `GEMINI_RETRY_BASE_DELAY_MS`. Erros transitórios `429/5xx` usam backoff exponencial; depois de esgotar o modelo principal, o texto tenta o fallback configurado.

O Gemini usa saída JSON estruturada em `generateContent` e geração de imagem pela Interactions API. Chaves nunca são persistidas em versões, logs ou respostas públicas.

## Máquina de estados

Uma lição percorre `DRAFT`, `IN_PROGRESS`, `PACKAGE_READY`, `IN_REVIEW`, `CHANGES_REQUESTED`, `READY_FOR_PUBLICATION`, `PUBLISHING` e `PUBLISHED`. Cada etapa mantém seu próprio estado e versões imutáveis. Alterar uma etapa invalida as posteriores.

`GET /api/v1/lessons/:id` é leitura pura: nunca cria etapas, atualiza templates ou revoga aprovação. A criação do pacote grava a lição e suas oito etapas numa única transação.

`GET /api/v1/lessons/:id/events` mantém um stream SSE autenticado com snapshots do pacote. `POST /api/v1/lessons/:id/stages/generate` persiste a solicitação e retorna sem aguardar o LLM; o processamento continua em background e é retomado na inicialização da API quando uma etapa permaneceu em `GENERATING`.

## Listagem

`GET /api/v1/lessons` aceita `status`, `search`, `page`, `limit`, `sort` (`createdAt`, `updatedAt`, `theme`, `weekNumber`) e `order` (`ASC`, `DESC`). Busca considera tema e referência bíblica. A ordenação usa allowlist e desempate por id.

## Publicação idempotente

`POST /api/v1/lessons/:id/publish-week-material` reserva a lição sob lock pessimista, alterando-a de `READY_FOR_PUBLICATION` para `PUBLISHING`. Requisições concorrentes recebem conflito. Após a criação da página semanal, a lição recebe `weekMaterialId` e passa a `PUBLISHED`; chamadas posteriores devolvem o mesmo vínculo sem criar outra página.

Se o provedor falhar antes de criar a página, o estado volta para `READY_FOR_PUBLICATION`. Se a página for criada e a confirmação no banco falhar, a lição permanece em `PUBLISHING` para impedir duplicação e exigir reconciliação operacional.

## Arquivos e privacidade

Uploads de uma geração são rastreados e removidos se qualquer imagem ou persistência posterior falhar. Na exclusão, os registros são removidos antes dos objetos; uma falha de S3 gera órfão auditável em vez de manter registros apontando para arquivos inexistentes.

As respostas usam DTOs públicos. Snapshots de prompt, IDs da OpenAI, checksums, chaves internas e identificadores de autoria não são expostos.
