# Diagramas do backend

As fontes PlantUML (`.puml`) ficam ao lado das imagens (`.png`). Este índice
aponta para as imagens; os fluxos compartilhados aparecem uma vez e são apenas
referenciados conceitualmente pelos módulos consumidores.

Nos fluxos, o cilindro identifica a persistência real (MySQL ou DynamoDB). O
S3 aparece somente quando há leitura de URL, upload, substituição ou exclusão
de objeto; módulos sem arquivos não recebem uma dependência de S3 artificial.

## Banco

Os schemas detalhados mostram somente chaves, restrições e campos necessários
para entender as relações; as entidades TypeORM continuam sendo a fonte completa.

- [Mapa geral — 32 entidades](database/database-schema.png)
- [Identidade e acesso](database/core-identity-schema.png)
- [Clubinhos, calendário e presença](database/clubs-attendance-schema.png)
- [Conteúdo e comunicação](database/content-schema.png)
- [Páginas, mídia e S3](database/pages-media-schema.png)
- [Estúdio Clubinho](database/ai-lessons-schema.png)

## Core e acesso

- [Sonda de saúde](flow/health/health-flow.png)
- [Autenticação](flow/auth/auth-flow.png)
- [Descadastro de e-mails](flow/email-preferences/email-preferences-flow.png)
- [Usuários](flow/users/users-flow.png)
- [Perfis completos](flow/profiles/profiles-flow.png)
- [Perfis de professores](flow/teacher-profiles/teacher-profiles-flow.png)
- [Perfis de coordenadores](flow/coordinator-profiles/coordinator-profiles-flow.png)
- [Feature flags](flow/feature-flags/feature-flags-flow.png)
- [Observabilidade e auditoria](flow/observability/observability-flow.png)
- [Consulta e exclusão de logs](flow/log-records/log-records-flow.png)

## Clubinhos e acompanhamento

- [Clubinhos](flow/clubs/clubs-flow.png)
- [Crianças](flow/children/children-registration-flow.png)
- [Endereços internos](flow/addresses/addresses-flow.png)
- [Controle dos clubinhos](flow/club-control/club-control-flow.png)
- [Pagelas](flow/pagelas/pagelas-flow.png)
- [Decisões por Cristo](flow/accepted-christs/accepted-christs-flow.png)
- [Estatísticas](flow/statistics/statistics-flow.png)

## Conteúdo e comunicação

- [Comentários](flow/comments/comments-flow.png)
- [Contatos](flow/contacts/contacts-flow.png)
- [Avaliações do site](flow/site-feedbacks/site-feedbacks-flow.png)
- [Documentos](flow/documents/documents-flow.png)
- [Informativos](flow/informatives/informatives-flow.png)
- [Meditações](flow/meditations/meditations-flow.png)
- [Páginas de ideias](flow/ideas-pages/ideas-pages-flow.png)
- [Ideias compartilhadas](flow/ideas-sections/ideas-sections-flow.png)
- [Galerias](flow/image-pages/image-pages-flow.png)
- [Fotos compartilhadas](flow/image-sections/image-sections-flow.png)
- [Páginas de vídeos](flow/video-pages/video-pages-flow.png)
- [Materiais da semana](flow/week-materials/week-materials-flow.png)
- [Estúdio Clubinho](flow/ai-lessons/ai-lessons-flow.png)
- [Estúdio Clubinho — máquina de estados](flow/ai-lessons/ai-lessons-states.png)
- [Rotas de conteúdo](flow/routes/routes-flow.png)

## Eventos

- [Consulta e recorte por datas](flow/events/events-query-flow.png)
- [Operações administrativas](flow/events/events-management-flow.png)
- [Sincronização dos encontros](flow/events/club-meeting-sync-flow.png)

## Infraestrutura compartilhada

- [Persistência e provedores](flow/infrastructure/storage-providers-flow.png)
- [E-mail](flow/email/email-flow.png)
- [Mídia e S3](flow/media/media-flow.png)
- [Agendador](flow/scheduling/scheduling-flow.png)
