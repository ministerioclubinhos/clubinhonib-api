/**
 * Audita os arquivos do bucket contra `media_items`, `lesson_versions` e `lesson_stages`.
 *
 * Relata inconsistências:
 *  - ÓRFÃOS: objeto no bucket que nenhuma mídia ou versão/etapa do Studio referencia
 *    e que não é um upload do Studio protegido em andamento/sem ledger;
 *  - PROTEGIDOS (STUDIO): objetos referenciados por versões/etapas de lições ou
 *    protegidos conservadoramente por padrão de upload do Studio;
 *  - QUEBRADOS: mídia no banco cujo objeto não está mais no bucket.
 *
 * Por padrão só relata (dry-run). A remoção exige `--delete --confirm` e falha de forma
 * conservadora (fail-closed) se qualquer tabela/fonte de referência não puder ser lida
 * ou contiver JSON inválido.
 *
 *   node scripts/s3/audit-orphans.js
 *   node scripts/s3/audit-orphans.js --out=orfaos.json
 *   node scripts/s3/audit-orphans.js --delete --confirm
 */
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');

const STUDIO_STAGE_TOKENS = [
  'LESSON',
  'LESSON_VISUALS',
  'STANDARD_GAME',
  'VERSE_VISUALS',
  'VERSE_FIXATION',
  'MEDITATION_YOUNGER',
  'MEDITATION_OLDER',
  'MANUAL_WORK',
];

function loadEnvFile() {
  const envFile = process.env.ENV_FILE || 'env/local.env';
  const full = path.resolve(process.cwd(), envFile);
  if (!fs.existsSync(full)) return;

  for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] === undefined) {
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
    }
  }
}

function parseArgs(argv) {
  const args = { delete: false, confirm: false, out: '' };
  for (const arg of argv.slice(2)) {
    if (arg === '--delete') args.delete = true;
    else if (arg === '--confirm') args.confirm = true;
    else if (arg.startsWith('--out=')) args.out = arg.slice('--out='.length);
  }
  return args;
}

/** Chave do objeto dentro do bucket, nas duas formas de URL do S3 ou chave direta. */
function extractKey(urlOrKey, bucket) {
  if (!urlOrKey || typeof urlOrKey !== 'string') return null;
  const trimmed = urlOrKey.trim();
  if (!trimmed) return null;

  if (!trimmed.includes('://')) {
    if (trimmed.includes('/uploads/') || trimmed.startsWith('uploads/')) {
      return trimmed.replace(/^\/+/, '');
    }
    return null;
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (!parsed.hostname.endsWith('.amazonaws.com')) return null;

  const key = decodeURIComponent(parsed.pathname).replace(/^\//, '');
  if (!key) return null;

  if (parsed.hostname.startsWith(`${bucket}.s3`)) return key;

  const prefix = `${bucket}/`;
  if (parsed.hostname.startsWith('s3.') && key.startsWith(prefix)) {
    return key.slice(prefix.length) || null;
  }

  return null;
}

function collectStringsFromJson(value, out = []) {
  if (!value) return out;
  if (typeof value === 'string') {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStringsFromJson(item, out);
    return out;
  }
  if (typeof value === 'object') {
    for (const entry of Object.values(value)) {
      collectStringsFromJson(entry, out);
    }
  }
  return out;
}

function parseJsonColumn(raw, contextLabel) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error(
        `JSON inválido em ${contextLabel}: ${error?.message || String(error)}`,
      );
    }
  }
  return null;
}

function isPotentialStudioUploadKey(key) {
  if (!key || typeof key !== 'string') return false;
  const baseName = key.split('/').pop() || key;
  return STUDIO_STAGE_TOKENS.some(
    (token) =>
      baseName.includes(`-${token}-`) ||
      baseName.includes(`_${token}_`) ||
      baseName.includes(`-${token}.`),
  );
}

async function listBucketObjects(s3, bucket, prefix) {
  const objects = [];
  let token;

  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );

    for (const item of page.Contents ?? []) {
      objects.push({
        key: item.Key,
        size: item.Size ?? 0,
        lastModified: item.LastModified,
      });
    }

    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);

  return objects;
}

function registerReference(byKey, key, ref) {
  if (!byKey.has(key)) byKey.set(key, []);
  byKey.get(key).push(ref);
}

async function loadReferencedKeys(connection, bucket) {
  const byKey = new Map();
  const foreign = [];

  const [mediaRows] = await connection.execute(
    'SELECT id, url, targetType, targetId FROM media_items WHERE url IS NOT NULL AND url <> ""',
  );
  if (!Array.isArray(mediaRows)) {
    throw new Error('Fonte de referência media_items indisponível.');
  }

  for (const row of mediaRows) {
    const key = extractKey(row.url, bucket);
    if (!key) {
      foreign.push({ source: 'media_items', ...row });
      continue;
    }
    registerReference(byKey, key, {
      source: 'media_items',
      id: row.id,
      url: row.url,
      targetType: row.targetType,
      targetId: row.targetId,
    });
  }

  const [versionRows] = await connection.execute(
    'SELECT id, stage_id AS stageId, docxS3Key, pdfS3Key, structuredDataJson, tiptapAstJson FROM lesson_versions',
  );
  if (!Array.isArray(versionRows)) {
    throw new Error('Fonte de referência lesson_versions indisponível.');
  }

  for (const row of versionRows) {
    for (const directField of ['docxS3Key', 'pdfS3Key']) {
      if (row[directField]) {
        const key = extractKey(row[directField], bucket);
        if (key) {
          registerReference(byKey, key, {
            source: 'lesson_versions',
            id: row.id,
            field: directField,
            url: row[directField],
          });
        }
      }
    }

    const structured = parseJsonColumn(
      row.structuredDataJson,
      `lesson_versions(${row.id}).structuredDataJson`,
    );
    const tiptap = parseJsonColumn(
      row.tiptapAstJson,
      `lesson_versions(${row.id}).tiptapAstJson`,
    );

    const strings = [
      ...collectStringsFromJson(structured),
      ...collectStringsFromJson(tiptap),
    ];
    for (const candidate of strings) {
      const key = extractKey(candidate, bucket);
      if (key) {
        registerReference(byKey, key, {
          source: 'lesson_versions',
          id: row.id,
          stageId: row.stageId,
          url: candidate,
        });
      }
    }
  }

  const [stageRows] = await connection.execute(
    'SELECT id, lesson_id AS lessonId, type, status, generation_request_json AS generationRequestJson FROM lesson_stages WHERE status = "GENERATING" OR generation_request_json IS NOT NULL',
  );
  if (!Array.isArray(stageRows)) {
    throw new Error('Fonte de referência lesson_stages indisponível.');
  }

  const activeGeneratingLessonIds = new Set();
  for (const row of stageRows) {
    if (row.status === 'GENERATING' && row.lessonId) {
      activeGeneratingLessonIds.add(row.lessonId);
    }
    const genReq = parseJsonColumn(
      row.generationRequestJson,
      `lesson_stages(${row.id}).generationRequestJson`,
    );
    for (const candidate of collectStringsFromJson(genReq)) {
      const key = extractKey(candidate, bucket);
      if (key) {
        registerReference(byKey, key, {
          source: 'lesson_stages',
          id: row.id,
          lessonId: row.lessonId,
          url: candidate,
        });
      }
    }
  }

  return {
    byKey,
    foreign,
    total: mediaRows.length,
    lessonVersionsCount: versionRows.length,
    activeStagesCount: stageRows.length,
    activeGeneratingLessonIds,
  };
}

const formatMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

async function main() {
  loadEnvFile();
  const args = parseArgs(process.argv);

  const bucket = process.env.AWS_S3_BUCKET_NAME;
  const region = process.env.AWS_REGION || 'us-east-1';
  const environment = process.env.ENVIRONMENT ?? '';
  const prefix = `${environment}/uploads/`;

  if (!bucket) throw new Error('AWS_S3_BUCKET_NAME não definido.');

  console.log(`Bucket:   ${bucket} (${region})`);
  console.log(`Prefixo:  ${prefix}`);
  console.log(`Banco:    ${process.env.DB_NAME}@${process.env.DB_HOST}\n`);

  const s3 = new S3Client({ region });
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const objects = await listBucketObjects(s3, bucket, prefix);
    const {
      byKey,
      foreign,
      total,
      lessonVersionsCount,
      activeGeneratingLessonIds,
    } = await loadReferencedKeys(connection, bucket);

    const bucketKeys = new Set(objects.map((object) => object.key));
    const protectedStudioUploads = [];
    const orphans = [];

    for (const object of objects) {
      if (byKey.has(object.key)) continue;
      const isInFlightLessonAsset = [...activeGeneratingLessonIds].some((id) =>
        object.key.includes(id),
      );
      if (isInFlightLessonAsset || isPotentialStudioUploadKey(object.key)) {
        protectedStudioUploads.push({
          ...object,
          protectedBy: isInFlightLessonAsset
            ? 'lesson_stages:GENERATING'
            : 'studio_upload_pattern_guard',
        });
        continue;
      }
      orphans.push(object);
    }

    const broken = [...byKey.entries()]
      .filter(([key]) => !bucketKeys.has(key))
      .flatMap(([, rows]) => rows);

    const wastedBytes = orphans.reduce((sum, item) => sum + item.size, 0);

    console.log(`Objetos no bucket:        ${objects.length}`);
    console.log(`Mídias no banco:          ${total}`);
    console.log(`Versões do Studio lidas:  ${lessonVersionsCount}`);
    console.log(
      `Protegidos pelo Studio:   ${protectedStudioUploads.length}`,
    );
    console.log(`  fora deste bucket:      ${foreign.length} (links externos)`);
    console.log(
      `ÓRFÃOS (arquivo sem vínculo): ${orphans.length} — ${formatMB(wastedBytes)}`,
    );
    console.log(`QUEBRADOS (referência sem arquivo): ${broken.length}\n`);

    for (const item of orphans.slice(0, 20)) {
      console.log(
        `  órfão  ${item.key}  ${formatMB(item.size)}  ${item.lastModified?.toISOString() ?? ''}`,
      );
    }
    if (orphans.length > 20) {
      console.log(`  ... e mais ${orphans.length - 20}`);
    }

    for (const row of broken.slice(0, 20)) {
      console.log(
        `  quebrado  ${row.source}.id=${row.id}  ${row.url}`,
      );
    }
    if (broken.length > 20) {
      console.log(`  ... e mais ${broken.length - 20}`);
    }

    if (args.out) {
      fs.writeFileSync(
        args.out,
        JSON.stringify(
          { orphans, protectedStudioUploads, broken, foreign },
          null,
          2,
        ),
      );
      console.log(`\nRelatório salvo em ${args.out}`);
    }

    if (!args.delete) {
      console.log(
        '\nNada foi apagado. Use --delete --confirm para remover só os órfãos confirmados.',
      );
      return;
    }

    if (!args.confirm) {
      console.log('\n--delete exige também --confirm. Nada foi apagado.');
      return;
    }

    for (const item of orphans) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: item.key }));
      console.log(`removido  ${item.key}`);
    }
    console.log(
      `\n${orphans.length} órfão(s) removido(s), ${formatMB(wastedBytes)} liberados.`,
    );
  } finally {
    await connection.end();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractKey,
    collectStringsFromJson,
    parseJsonColumn,
    isPotentialStudioUploadKey,
    loadReferencedKeys,
    listBucketObjects,
    parseArgs,
    main,
  };
}

const isDirectExecution =
  typeof require !== 'undefined' && typeof module !== 'undefined'
    ? require.main === module
    : true;

if (isDirectExecution) {
  main().catch((error) => {
    console.error('\nFalha na auditoria:', error?.message || error);
    console.error(error?.stack || '');
    process.exit(1);
  });
}
