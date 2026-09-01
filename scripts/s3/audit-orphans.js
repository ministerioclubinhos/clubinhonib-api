/**
 * Audita os arquivos do bucket contra a tabela `media_items`.
 *
 * Relata duas inconsistências:
 *  - ÓRFÃOS: objeto no bucket que nenhuma mídia referencia (ocupa espaço à toa);
 *  - QUEBRADOS: mídia no banco cujo objeto não está mais no bucket (a página
 *    exibe um link morto).
 *
 * Por padrão só relata. A remoção exige `--delete --confirm` e apaga apenas os
 * órfãos — nunca os quebrados, que precisam ser resolvidos no banco.
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

/** Chave do objeto dentro do bucket, nas duas formas de URL do S3. */
function extractKey(url, bucket) {
  let parsed;
  try {
    parsed = new URL(url);
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

async function loadReferencedKeys(connection, bucket) {
  const [rows] = await connection.execute(
    'SELECT id, url, targetType, targetId FROM media_items WHERE url IS NOT NULL AND url <> ""',
  );

  const byKey = new Map();
  const foreign = [];

  for (const row of rows) {
    const key = extractKey(row.url, bucket);
    if (!key) {
      foreign.push(row);
      continue;
    }
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(row);
  }

  return { byKey, foreign, total: rows.length };
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
    const { byKey, foreign, total } = await loadReferencedKeys(
      connection,
      bucket,
    );

    const bucketKeys = new Set(objects.map((object) => object.key));
    const orphans = objects.filter((object) => !byKey.has(object.key));
    const broken = [...byKey.entries()]
      .filter(([key]) => !bucketKeys.has(key))
      .flatMap(([, rows]) => rows);

    const wastedBytes = orphans.reduce((sum, item) => sum + item.size, 0);

    console.log(`Objetos no bucket:        ${objects.length}`);
    console.log(`Mídias no banco:          ${total}`);
    console.log(`  fora deste bucket:      ${foreign.length} (links externos)`);
    console.log(
      `ÓRFÃOS (arquivo sem mídia): ${orphans.length} — ${formatMB(wastedBytes)}`,
    );
    console.log(`QUEBRADOS (mídia sem arquivo): ${broken.length}\n`);

    for (const item of orphans.slice(0, 20)) {
      console.log(
        `  órfão  ${item.key}  ${formatMB(item.size)}  ${item.lastModified?.toISOString() ?? ''}`,
      );
    }
    if (orphans.length > 20) {
      console.log(`  ... e mais ${orphans.length - 20}`);
    }

    for (const row of broken.slice(0, 20)) {
      console.log(`  quebrado  media_items.id=${row.id}  ${row.url}`);
    }
    if (broken.length > 20) {
      console.log(`  ... e mais ${broken.length - 20}`);
    }

    if (args.out) {
      fs.writeFileSync(
        args.out,
        JSON.stringify({ orphans, broken, foreign }, null, 2),
      );
      console.log(`\nRelatório salvo em ${args.out}`);
    }

    if (!args.delete) {
      console.log(
        '\nNada foi apagado. Use --delete --confirm para remover só os órfãos.',
      );
      return;
    }

    if (!args.confirm) {
      console.log(
        '\n--delete exige também --confirm. Nada foi apagado.',
      );
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

main().catch((error) => {
  console.error('\nFalha na auditoria:', error?.message || error);
  console.error(error?.stack || '');
  process.exit(1);
});
