const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

const DIAGRAMS_DIR = path.join(__dirname, '../docs/diagrams');

/**
 * Renders a PlantUML string to PNG using Kroki or local plantuml CLI.
 */
async function renderPlantUmlToPng(pumlContent, outputPath) {
  const tempPuml = outputPath.replace(/\.png$/, '.temp.puml');
  const tempPng = outputPath.replace(/\.png$/, '.temp.png');
  try {
    execSync('which plantuml', { stdio: 'ignore' });
    fs.writeFileSync(tempPuml, pumlContent, 'utf8');
    execSync(`plantuml -tpng "${tempPuml}" -o "${path.dirname(outputPath)}"`, { stdio: 'inherit' });
    if (fs.existsSync(tempPuml)) {
      fs.unlinkSync(tempPuml);
    }
    if (fs.existsSync(tempPng)) {
      fs.renameSync(tempPng, outputPath);
    }
    return;
  } catch (_err) {
    if (fs.existsSync(tempPuml)) {
      fs.unlinkSync(tempPuml);
    }
    if (fs.existsSync(tempPng)) {
      fs.unlinkSync(tempPng);
    }
    // Fall back to HTTP rendering via Kroki service
  }

  return new Promise((resolve, reject) => {
    const postData = Buffer.from(pumlContent, 'utf8');
    const options = {
      hostname: 'kroki.io',
      port: 443,
      path: '/plantuml/png',
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Length': postData.length,
      },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        let errBody = '';
        res.on('data', (chunk) => (errBody += chunk));
        res.on('end', () => {
          reject(new Error(`Kroki API returned status ${res.statusCode}: ${errBody}`));
        });
        return;
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        fs.writeFileSync(outputPath, buffer);
        resolve();
      });
    });

    req.on('error', (err) => reject(err));
    req.write(postData);
    req.end();
  });
}

/**
 * Recursively find all .puml / .plantuml files in a directory.
 */
function findPumlFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findPumlFiles(fullPath, fileList);
    } else if (entry.isFile() && (entry.name.endsWith('.puml') || entry.name.endsWith('.plantuml'))) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

async function main() {
  const specificFile = process.argv[2];
  let pumlFiles = [];

  if (specificFile) {
    const absolutePath = path.resolve(process.cwd(), specificFile);
    if (fs.existsSync(absolutePath)) {
      pumlFiles = [absolutePath];
    } else {
      console.error(`Specified file not found: ${specificFile}`);
      process.exit(1);
    }
  } else {
    pumlFiles = findPumlFiles(DIAGRAMS_DIR);
  }

  if (pumlFiles.length === 0) {
    console.log('No PlantUML (.puml / .plantuml) files found in docs/diagrams.');
    return;
  }

  console.log(`Found ${pumlFiles.length} PlantUML file(s). Generating PNGs...`);

  for (const pumlPath of pumlFiles) {
    const relativePath = path.relative(path.join(__dirname, '..'), pumlPath);
    const pngPath = pumlPath.replace(/\.(puml|plantuml)$/, '.png');
    const relativePngPath = path.relative(path.join(__dirname, '..'), pngPath);

    try {
      const content = fs.readFileSync(pumlPath, 'utf8');
      await renderPlantUmlToPng(content, pngPath);
      console.log(`[SUCCESS] Rendered ${relativePath} -> ${relativePngPath}`);
    } catch (err) {
      console.error(`[ERROR] Failed to render ${relativePath}:`, err.message);
    }
  }
}

main().catch((err) => {
  console.error('Unhandled error in diagram generator:', err);
  process.exit(1);
});
