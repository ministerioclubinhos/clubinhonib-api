# Fila Redis para todas as chamadas a provedores de IA

Toda requisição de saída para OpenAI/Gemini é submetida por `AiRequestQueueService` à fila BullMQ `llm-requests`. Isso inclui todas as etapas de lição, geração e edição de imagem, revisões de texto/imagem, retries, melhorias de ideias compartilhadas, reprocessamento pelo administrador e o catálogo de modelos da OpenAI ao vivo. Renderizar PDF/DOCX e baixar artes já existentes não chamam LLM e ficam fora da fila. Novas integrações de IA devem usar o mesmo contrato.

Rotas, permissões, snapshots, seleção de modelo e regras de publicação não mudam. Os workers de lição/ideia no MySQL continuam orquestrando o trabalho de domínio e renovando suas leases enquanto aguardam o provedor. Cada instância da API também hospeda um worker BullMQ; o Redis aplica um limite global entre todas as instâncias e features. **Não existe fallback HTTP direto quando o Redis está indisponível.**

## Configuração

| Variável | Padrão | Significado |
| --- | --- | --- |
| `REDIS_URL` | `redis://127.0.0.1:6379/0` | Conexão Redis; `redis://` e `rediss://`, usuário/senha e número do banco opcionais. |
| `AI_QUEUE_PREFIX` | `clubinho` | Namespace compartilhado pelas réplicas do mesmo ambiente; use prefixos/bancos diferentes para ambientes diferentes. Letras, dígitos, `_`, `-`. |
| `AI_QUEUE_CONCURRENCY` | `1` | Máximo global de chamadas simultâneas a provedores, 1–20. Configure o mesmo valor em todas as réplicas. |
| `AI_QUEUE_WAIT_MS` | `900000` | Orçamento de espera na fila, 1–86400000 ms, somado ao timeout HTTP do provedor. |

Requer Redis 6.2+ (`GETDEL` e BullMQ); o helper local usa Redis 7. Use uma instância persistente com AOF e `maxmemory-policy noeviction`. Reserve capacidade para prompts, anexos em base64 e imagens geradas: cada requisição serializada e cada resposta são limitadas a 96 MiB. O acesso ao Redis deve ficar restrito à API/worker, porque o conteúdo enfileirado pode conter material privado.

As credenciais de OpenAI/Gemini são lidas das configurações no MySQL somente quando um worker executa a requisição; nunca entram no payload do job nem em headers guardados no Redis. Essas chaves só ficam criptografadas no banco quando `AI_PROVIDER_SETTINGS_ENCRYPTION_KEY` está definida (ver [api-ai-lessons.md](api-ai-lessons.md)). Modelo e corpo da requisição permanecem fixados ao pedido original. Credenciais do Redis nunca são impressas.

### Relação com a concorrência de gerações

`AI_LESSONS_MAX_CONCURRENT_GENERATIONS` (padrão 3 por instância) limita quantas etapas são orquestradas ao mesmo tempo; `AI_QUEUE_CONCURRENCY` (padrão 1, global) limita quantas chamadas a provedores de fato executam. Com os padrões, até três etapas avançam em paralelo, mas suas chamadas de texto e imagem são atendidas uma por vez, em ordem de chegada. Aumentar só o primeiro valor não acelera nada; aumentar o segundo aumenta o gasto simultâneo.

## Inicialização local

Na raiz do repositório:

```bash
./run.sh local
```

O runner prepara o Redis antes do DynamoDB, do seed e dos processos de API/app. O helper carrega o `ENV_FILE` da API selecionado; o ambiente do processo prevalece sobre o arquivo. Nenhum arquivo de ambiente é criado ou editado. Um PING bem-sucedido reutiliza a instância em execução sem exigir Docker. Quando um Redis de loopback sem autenticação e sem TLS não está disponível, o helper cria ou inicia `clubinho-redis-local`, publica apenas uma porta de loopback e persiste dados AOF no volume `clubinho-redis-data`. Ele não apaga nem recria contêiner/volume existente. Um servidor remoto, autenticado ou com TLS precisa estar disponível; a falha interrompe a subida sem trocar de servidor em silêncio.

Para preparar apenas o Redis, em `clubinhonib-api`:

```bash
ENV_FILE=env/local.env npm run redis:local:ensure
```

**A API sobe mesmo sem Redis.** A fila valida a configuração na inicialização; se o Redis não responder, a API registra o erro, mantém as rotas de IA degradadas (`AI_QUEUE_9201`) e tenta levantar a fila novamente a cada 10 s. Durante a operação, uma submissão aguarda até 5 s pela reconexão antes de falhar. Em produção, provisione o Redis e configure o mesmo namespace e a mesma concorrência em todas as réplicas; `run.sh` é conveniência local.

## Execução, falha e retenção

- Os destinos são restritos às APIs HTTPS suportadas de OpenAI/Gemini. Redirecionamentos, URLs com credenciais, query strings e destinos arbitrários são rejeitados.
- Imagens multipart preservam bytes, tipo MIME, nome de arquivo e campos repetidos.
- Cada job faz uma tentativa no provedor. As políticas de retry e de modelo fallback de cada feature enfileiram uma nova requisição por tentativa; o BullMQ não multiplica esses orçamentos.
- **Prioridade:** a consulta ao catálogo de modelos entra com prioridade alta e espera curta (10 s), para não ficar atrás de gerações longas; em falha, vale a lista de contingência.
- Os timeouts HTTP são limitados a 180 s. Os jobs carregam um prazo absoluto; trabalho expirado ou cancelado não chega ao provedor. Se a submissão ou a espera falhar, o produtor tenta gravar um marcador de cancelamento e remover o job em espera.
- **Proteção contra órfãos:** cada produtor mantém uma chave de vida no Redis (TTL de 30 s, renovada a cada 10 s). Antes de chamar o provedor, o worker descarta jobs cujo produtor não existe mais (`AI_QUEUE_ORPHANED`), evitando uma chamada paga cujo resultado ninguém consumiria.
- Os locks do worker duram 210 s, com renovação e detecção de travamento a cada 30 s. Uma recuperação de job travado é permitida. O processamento é **at-least-once**: uma queda após o sucesso do provedor e antes de persistir a resposta pode repetir uma chamada paga. Cobrança exatamente uma vez não é garantida.
- **Gravação do resultado:** só a persistência do resultado é repetida (4 tentativas com backoff); o provedor nunca é chamado de novo por causa de uma falha momentânea do Redis.
- Os resultados ficam separados, com TTL de cinco minutos. O produtor consome o resultado com `GETDEL` e remove o job terminal. Um worker recuperado reaproveita o resultado salvo. Um job limpo cujo resultado expirou falha em vez de chamar o provedor com corpo vazio.
- Prompts e anexos são apagados depois que o resultado é persistido. Jobs concluídos/falhos têm retenção de cinco minutos/1000 jobs e limpeza periódica.
- **Erros do provedor:** só saem do worker o status HTTP, códigos de rede, headers de retry e os identificadores de erro da allowlist (códigos/tipos da OpenAI e status canônico do Gemini, como `RESOURCE_EXHAUSTED`). Mensagens brutas, configuração da requisição, autenticação e conteúdo não são retidos.
- **Logs:** cada job registra identificador, feature, provedor, caminho, status, código do provedor, `x-request-id` e duração, sem prompts nem chaves. Eventos de falha e de travamento são registrados com a causa.

## Erros da fila

A fila lança `AiQueueException` (`AI_QUEUE_9201`; 503, ou 400 para pedidos internos inválidos), com o motivo em `details.reason`:

| Motivo | Significado |
| --- | --- |
| `AI_QUEUE_UNAVAILABLE` | Redis ou fila indisponível |
| `AI_QUEUE_EXPIRED` | Prazo vencido antes de chegar ao provedor |
| `AI_QUEUE_CANCELLED` | Pedido cancelado |
| `AI_QUEUE_INVALID_REQUEST` | Destino ou formato não permitido |
| `AI_QUEUE_RESULT_EXPIRED` | Resultado expirou antes de ser consumido |
| `AI_QUEUE_ORPHANED` | Produtor do job não existe mais |
| `AI_QUEUE_CREDENTIAL_MISSING` | Provedor sem chave de API legível |

No Estúdio, a etapa registra `AI_QUEUE_UNAVAILABLE`, `AI_QUEUE_TIMEOUT` ou `AI_CONFIGURATION_MISSING` conforme o motivo. Os jobs de ideias compartilhadas registram a falha no contrato de tentativa existente.

## Verificação

Os testes unitários usam mocks de Redis, BullMQ, configurações do banco e HTTP do provedor. Cobrem roteamento, concorrência global, comportamento fail-closed, prazo e cancelamento, multipart, separação de credenciais, erros seguros, retenção/recuperação de resultado e o Redis local. Testes de arquitetura rejeitam chamadas diretas a provedores nas features de IA. Não há teste de integração contra um Redis real.

```bash
npm test -- --runInBand src/shared/providers/ai-queue
npm run build
bash -n ../run.sh
```

[Fonte do fluxo](diagrams/flow/ai-request-queue/ai-request-queue.puml) · [Imagem do fluxo](diagrams/flow/ai-request-queue/ai-request-queue.png)

Referências BullMQ: [concorrência global](https://docs.bullmq.io/guide/queues/global-concurrency), [conexões](https://docs.bullmq.io/guide/connections), [jobs travados](https://docs.bullmq.io/guide/workers/stalled-jobs), [retenção terminal](https://docs.bullmq.io/guide/queues/auto-removal-of-jobs).
