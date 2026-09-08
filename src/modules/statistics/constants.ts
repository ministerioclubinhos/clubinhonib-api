/**
 * Conjuntos finitos e ajustes do módulo de estatísticas.
 */

/**
 * Por quanto tempo o panorama vale sem refazer as contas.
 *
 * `getOverviewStatistics` dispara dezoito chamadas de repositório, e várias
 * delas fazem consultas em paralelo por dentro: um request é da ordem de trinta
 * idas ao banco. Antes não havia cache nenhum — cada carga da tela, cada
 * remontagem de aba e cada administrador pagavam a conta inteira.
 *
 * Um minuto é curto de propósito. O painel não é um relógio: pagela não muda de
 * segundo a segundo. Mas o botão "Atualizar" precisa parecer que atualiza, e um
 * cache de quinze minutos faria a tela ignorar o clique sem explicar por quê.
 */
export const OVERVIEW_CACHE_TTL_MS = 60 * 1000;
