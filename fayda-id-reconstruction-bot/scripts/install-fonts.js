#!/usr/bin/env node
/**
 * Downloads Roboto and NotoSansEthiopic fonts from Google Fonts
 * and places them in assets/fonts/
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const FONTS_DIR = path.join(__dirname, '..', 'assets', 'fonts');

const FONTS = [
  {
    name: 'Roboto-Regular.ttf',
    url: 'https://github.com/openmaptiles/fonts/raw/master/roboto/Roboto-Regular.ttf',
  },
  {
    name: 'Roboto-Bold.ttf',
    url: 'https://github.com/openmaptiles/fonts/raw/master/roboto/Roboto-Bold.ttf',
  },
  {
    name: 'NotoSansEthiopic-Regular.ttf',
    url: 'https://github.com/notofonts/ethiopic/raw/main/fonts/NotoSansEthiopic/unhinted/ttf/NotoSansEthiopic-Regular.ttf',
  },
  {
    name: 'NotoSansEthiopic-Bold.ttf',
    url: 'https://github.com/notofonts/ethiopic/raw/main/fonts/NotoSansEthiopic/unhinted/ttf/NotoSansEthiopic-Bold.ttf',
  },
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) {
      console.log(`  ✓ Already exists: ${path.basename(dest)}`);
      return resolve();
    }

    const file = fs.createWriteStream(dest);
    const get = (u) => {
      https.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          return get(res.headers.location);
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          return reject(new Error(`HTTP ${res.statusCode} for ${u}`));
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', (err) => {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        reject(err);
      });
    };
    get(url);
  });
}

async function main() {
  if (!fs.existsSync(FONTS_DIR)) {
    fs.mkdirSync(FONTS_DIR, { recursive: true });
  }

  console.log('Downloading fonts...');
  for (const font of FONTS) {
    const dest = path.join(FONTS_DIR, font.name);
    process.stdout.write(`  Downloading ${font.name}... `);
    try {
      await download(font.url, dest);
      console.log('done');
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
  }

  console.log('\nFonts ready in assets/fonts/');
}

main().catch(console.error);
