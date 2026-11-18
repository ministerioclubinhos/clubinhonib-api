/**
 * Arquivos reais e leves para os uploads.
 *
 * Tudo que dá para escrever à mão sai daqui em tempo de execução, sem
 * dependência: PNG (zlib nativo), PDF, DOCX (zip "stored"), WAV, TXT e CSV.
 * Vídeo MP4, áudio MP3 e JPEG precisam de codec: ficam gravados em
 * `fixtures/` (gerados por ffmpeg, ~5-9 KB cada) e podem ser regenerados por
 * `regenerateEncodedFixtures()` quando há um ffmpeg disponível.
 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');
const { FFMPEG_PATH } = require('./config');

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

// ---------------------------------------------------------------- CRC32 -----
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// ------------------------------------------------------------------ PNG -----
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/**
 * PNG RGB de `width`x`height` com um degradê e uma faixa diagonal — imagem de
 * verdade, que abre em qualquer visualizador.
 */
function makePng({ width = 96, height = 96, seed = 0 } = {}) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // filtro "none"
    for (let x = 0; x < width; x++) {
      const diagonal = Math.abs(x - y) < 6;
      raw[offset++] = diagonal ? 255 : (x * 255) / width;
      raw[offset++] = diagonal ? 255 : (y * 255) / height;
      raw[offset++] = diagonal ? 255 : (seed * 37 + 90) % 256;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ PDF -----
function pdfEscape(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** PDF 1.4 de uma página, fonte Helvetica, com as linhas informadas. */
function makePdf({ title = 'Documento Clubinho NIB', lines = [] } = {}) {
  const content = [
    'BT',
    '/F1 18 Tf',
    '50 780 Td',
    `(${pdfEscape(title)}) Tj`,
    '/F1 11 Tf',
    ...lines.flatMap((line) => ['0 -20 Td', `(${pdfEscape(line)}) Tj`]),
    'ET',
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
  ];

  let body = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) body += `${String(off).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

// ------------------------------------------------------------- ZIP/DOCX -----
function dosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

/** ZIP sem compressão (método "stored"); suficiente para DOCX e leve. */
function makeZip(entries) {
  const { time, day } = dosDateTime(new Date());
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const { name, content } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);

    locals.push(local, nameBuf, data);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralBuf, end]);
}

function xmlEscape(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** DOCX mínimo válido (Word/LibreOffice abrem) com um parágrafo por linha. */
function makeDocx({ title = 'Documento Clubinho NIB', lines = [] } = {}) {
  const paragraphs = [title, ...lines]
    .map((line) => `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r></w:p>`)
    .join('');
  const document =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${paragraphs}<w:sectPr/></w:body></w:document>`;
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>';
  const rels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>';
  return makeZip([
    { name: '[Content_Types].xml', content: contentTypes },
    { name: '_rels/.rels', content: rels },
    { name: 'word/document.xml', content: document },
  ]);
}

// ------------------------------------------------------------------ WAV -----
/** WAV PCM 16 bits mono com um tom senoidal; `seconds` curto mantém leve. */
function makeWav({ seconds = 1, frequency = 440, sampleRate = 8000 } = {}) {
  const samples = Math.floor(seconds * sampleRate);
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    const envelope = Math.min(1, (samples - i) / (sampleRate * 0.1), i / (sampleRate * 0.05));
    const value = Math.round(Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 12000 * envelope);
    data.writeInt16LE(value, i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// -------------------------------------------------------- codec fixtures -----
function findFfmpeg() {
  const candidates = [FFMPEG_PATH, 'ffmpeg'].filter(Boolean);
  for (const bin of candidates) {
    const probe = spawnSync(bin, ['-version'], { stdio: 'ignore' });
    if (probe.status === 0) return bin;
  }
  return null;
}

/**
 * Regera MP4/MP3/JPG com ffmpeg. Devolve `false` quando não há ffmpeg — os
 * arquivos já gravados em `fixtures/` continuam valendo.
 */
function regenerateEncodedFixtures() {
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) return false;
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  const run = (args) => spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
  run(['-f', 'lavfi', '-i', 'testsrc=size=160x120:rate=10:duration=2', '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '35', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(FIXTURES_DIR, 'sample.mp4')]);
  run(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-c:a', 'libmp3lame', '-b:a', '32k', '-ac', '1', '-ar', '22050', path.join(FIXTURES_DIR, 'sample.mp3')]);
  run(['-f', 'lavfi', '-i', 'testsrc=size=160x120:rate=1:duration=1', '-frames:v', '1', '-q:v', '8', path.join(FIXTURES_DIR, 'sample.jpg')]);
  return true;
}

function readFixture(name) {
  const file = path.join(FIXTURES_DIR, name);
  if (!fs.existsSync(file)) {
    throw new Error(`Fixture ausente: ${file}. Rode com FFMPEG_PATH apontando para um ffmpeg ou restaure a pasta scripts/automations/fixtures.`);
  }
  return fs.readFileSync(file);
}

// ------------------------------------------------------------ catálogo -----
/**
 * Um arquivo pronto para o multipart: `{ filename, contentType, content }`.
 * `kind`: png | jpg | pdf | docx | txt | csv | wav | mp3 | mp4
 */
function fixture(kind, { name, seed = 0, title, lines } = {}) {
  const stamp = Date.now();
  const text = lines ?? [`Gerado pela automação em ${new Date().toISOString()}`, 'Clubinho NIB - arquivo de teste', `seed=${seed}`];
  switch (kind) {
    case 'png':
      return { filename: name || `imagem-${stamp}.png`, contentType: 'image/png', content: makePng({ seed }) };
    case 'jpg':
      return { filename: name || `foto-${stamp}.jpg`, contentType: 'image/jpeg', content: readFixture('sample.jpg') };
    case 'pdf':
      return { filename: name || `documento-${stamp}.pdf`, contentType: 'application/pdf', content: makePdf({ title, lines: text }) };
    case 'docx':
      return {
        filename: name || `documento-${stamp}.docx`,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        content: makeDocx({ title, lines: text }),
      };
    case 'txt':
      return { filename: name || `notas-${stamp}.txt`, contentType: 'text/plain', content: Buffer.from([title, ...text].filter(Boolean).join('\n'), 'utf8') };
    case 'csv':
      return {
        filename: name || `planilha-${stamp}.csv`,
        contentType: 'text/csv',
        content: Buffer.from(['semana,presentes,ausentes', '1,10,2', '2,9,3', '3,11,1'].join('\n'), 'utf8'),
      };
    case 'wav':
      return { filename: name || `audio-${stamp}.wav`, contentType: 'audio/wav', content: makeWav({ seconds: 1, frequency: 440 + seed * 20 }) };
    case 'mp3':
      return { filename: name || `audio-${stamp}.mp3`, contentType: 'audio/mpeg', content: readFixture('sample.mp3') };
    case 'mp4':
      return { filename: name || `video-${stamp}.mp4`, contentType: 'video/mp4', content: readFixture('sample.mp4') };
    default:
      throw new Error(`Tipo de fixture desconhecido: ${kind}`);
  }
}

module.exports = {
  FIXTURES_DIR,
  fixture,
  makePng,
  makePdf,
  makeDocx,
  makeWav,
  makeZip,
  crc32,
  findFfmpeg,
  regenerateEncodedFixtures,
};
