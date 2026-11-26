/**
 * Semeia pagelas de demonstração para a tela `/adm/resumo-semanal`.
 *
 * O objetivo é **ver o desenho**: da semana 1 até a semana em curso, cada
 * clubinho recebe um cenário diferente, de modo que todas as situações do
 * quadro apareçam — em dia, parcial, sem pagela, dia sem Clubinho e a semana
 * atual ainda aguardando.
 *
 * Duas semanas ficam **propositalmente vazias**, para mostrar como uma semana
 * não preenchida aparece na faixa e na lista.
 *
 * ⚠️ Isto é dado de demonstração: para o cenário "sem pagela" existir, o script
 * **apaga** as pagelas do ano nas células que devem ficar vazias. Ele recusa
 * rodar contra qualquer API que não seja a local, a menos que
 * `ALLOW_REMOTE_SEED=1` seja passado explicitamente.
 *
 * Uso:
 *   DRY_RUN=1 npm run seed:weekly-summary  # só conta o que faria
 *   npm run seed:weekly-summary            # ano corrente
 *   YEAR=2026 npm run seed:weekly-summary
 */
const { createHttpClient } = require('./automations/common/http');
const { createLogger } = require('./automations/logger');
const { fetchAllPages } = require('./automations/common/pagination');
const { errorStatus, errorMessage } = require('./automations/common/errors');
const { ensureAcademicPeriod, ensureException } = require('./automations/club-control/create');
const {
  computeTotalWeeks,
  dateForWeek,
  startWeekFor,
  academicWeekOf,
  loadChildren,
} = require('./automations/pagelas/shared');

/** Cenário de uma célula (clubinho × semana). */
const SCENARIO = {
  FULL: 'full',
  PARTIAL: 'partial',
  EMPTY: 'empty',
};

/**
 * A rotação que espalha os cenários pelo quadro.
 *
 * Indexada por `(semana + índice do clubinho) % 6`: assim a mesma semana sai
 * diferente em cada clubinho, e o mesmo clubinho varia de semana para semana —
 * que é o que faz a faixa do ano ter o que mostrar.
 */
const ROTATION = [
  SCENARIO.FULL,
  SCENARIO.FULL,
  SCENARIO.PARTIAL,
  SCENARIO.EMPTY,
  SCENARIO.FULL,
  SCENARIO.PARTIAL,
];

/** Semanas que ficam vazias em todos os clubinhos. */
const BLANK_WEEKS = [3, 7];

/** Semana em que se cadastra um dia sem Clubinho, para o status `exception`. */
const EXCEPTION_WEEK = 5;

/** Fração de crianças com pagela num cenário parcial, por semana. */
function partialRatio(week) {
  return week % 2 === 0 ? 0.6 : 0.35;
}

/** Presença determinística: a mesma criança na mesma semana dá sempre igual. */
function attendance(childIndex, week) {
  const seed = (childIndex * 7 + week * 13) % 10;
  const present = seed > 1;
  return {
    present,
    didMeditation: present && seed % 3 !== 0,
    recitedVerse: present && seed % 4 !== 0,
    notes: present ? null : 'Faltou',
  };
}

function assertLocalTarget(http, logger) {
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(http.baseURL);
  if (isLocal || process.env.ALLOW_REMOTE_SEED === '1') return;

  logger.error(
    `[seed-weekly-summary] recusando rodar contra ${http.baseURL}: este script apaga pagelas. ` +
      'Rode contra a API local, ou passe ALLOW_REMOTE_SEED=1 se for mesmo o que você quer.',
  );
  process.exit(1);
}

async function main() {
  const logger = createLogger();
  const http = createHttpClient();
  assertLocalTarget(http, logger);

  const year = Number(process.env.YEAR) || new Date().getFullYear();
  const dryRun = process.env.DRY_RUN === '1';
  if (dryRun) logger.warn('[seed-weekly-summary] DRY_RUN: nada será criado nem apagado.');

  logger.section('seed-weekly-summary');
  await http.login();

  const period = await ensureAcademicPeriod({ http, year });
  const totalWeeks = computeTotalWeeks(period);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const currentWeek = academicWeekOf(todayStr, period) ?? totalWeeks;

  const clubs = (await http.request('get', '/clubs/all')).data.filter((club) => club.isActive !== false);
  if (clubs.length === 0) {
    logger.error('[seed-weekly-summary] nenhum clubinho ativo: rode `npm run populate` antes.');
    process.exit(1);
  }

  const children = await loadChildren(http, {});
  const childrenByClub = new Map();
  for (const child of children) {
    const clubId = child.club?.id;
    if (!clubId) continue;
    const list = childrenByClub.get(clubId) ?? [];
    list.push(child);
    childrenByClub.set(clubId, list);
  }

  logger.info(
    `[seed-weekly-summary] ano=${year} semanas=1..${currentWeek} (de ${totalWeeks}) clubinhos=${clubs.length} criancas=${children.length}`,
  );

  // Um dia sem Clubinho, para o status `exception` aparecer no quadro.
  if (EXCEPTION_WEEK <= currentWeek && !dryRun) {
    const exceptionDate = dateForWeek(period, EXCEPTION_WEEK, clubs[0].weekday);
    const { created } = await ensureException({
      http,
      exceptionDate,
      reason: 'Feriado (dado de demonstração)',
      type: 'holiday',
      notes: 'Criado por scripts/seed-weekly-summary-demo.js',
    });
    logger.info(
      `[seed-weekly-summary] dia sem Clubinho em ${exceptionDate} (${created ? 'criado' : 'já existia'})`,
    );
  }

  let created = 0;
  let deleted = 0;
  let duplicates = 0;
  let failed = 0;

  for (const [clubIndex, club] of clubs.entries()) {
    const clubChildren = childrenByClub.get(club.id) ?? [];
    if (clubChildren.length === 0) continue;

    // As pagelas do ano já lançadas para este clubinho, por semana.
    const existing = new Map();
    for (const child of clubChildren) {
      const pagelas = await fetchAllPages(
        http.request,
        'get',
        '/pagelas/paginated',
        { childId: child.id, year },
        { limit: 200 },
      );
      for (const pagela of pagelas) {
        const key = `${child.id}:${pagela.week}`;
        existing.set(key, pagela.id);
      }
    }

    for (let week = 1; week <= currentWeek; week++) {
      const scenario = BLANK_WEEKS.includes(week)
        ? SCENARIO.EMPTY
        : ROTATION[(week + clubIndex) % ROTATION.length];

      const ratio =
        scenario === SCENARIO.FULL ? 1 : scenario === SCENARIO.PARTIAL ? partialRatio(week) : 0;
      const target = Math.round(clubChildren.length * ratio);
      const referenceDate = dateForWeek(period, week, club.weekday);

      for (const [childIndex, child] of clubChildren.entries()) {
        const key = `${child.id}:${week}`;
        const wanted = childIndex < target && startWeekFor(child, period) <= week;
        const has = existing.has(key);

        if (wanted && has) {
          duplicates++;
          continue;
        }

        if (!wanted && has) {
          try {
            if (!dryRun) await http.request('delete', `/pagelas/${existing.get(key)}`);
            existing.delete(key);
            deleted++;
          } catch (e) {
            failed++;
            if (failed <= 10) logger.warn(`[seed-weekly-summary] delete week=${week}: ${errorMessage(e)}`);
          }
          continue;
        }

        if (!wanted) continue;

        try {
          if (dryRun) {
            created++;
            continue;
          }
          const res = await http.request('post', '/pagelas', {
            data: { childId: child.id, referenceDate, ...attendance(childIndex, week) },
          });
          existing.set(key, res.data?.id);
          created++;
        } catch (e) {
          if (errorStatus(e) === 409) {
            duplicates++;
            continue;
          }
          failed++;
          if (failed <= 10) {
            logger.warn(`[seed-weekly-summary] clube=${club.number} week=${week}: ${errorMessage(e)}`);
          }
        }
      }
    }

    logger.info(`[seed-weekly-summary] clubinho ${club.number} pronto (criadas=${created} apagadas=${deleted})`);
  }

  logger.ok(
    `[seed-weekly-summary] concluído: criadas=${created} apagadas=${deleted} jaExistiam=${duplicates} falhas=${failed}`,
  );
  logger.info('[seed-weekly-summary] abra /adm/resumo-semanal para ver o quadro.');
}

main().catch((err) => {
  console.error('\n Fatal error:', err?.message || err);
  console.error(err?.stack || '');
  process.exit(1);
});
