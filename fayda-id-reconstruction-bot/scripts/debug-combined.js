/**
 * Draws labelled boxes/dots on bg_combined.png showing every field position.
 *
 * Run:  node scripts/debug-combined.js
 * Out:  assets/debug_combined.png
 *
 * Edit src/card-generator/coords.ts to move things, then re-run this script.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs   = require('fs');
const path = require('path');

// ── Import coords (CommonJS-compatible read of the TS source) ─────────────────
// We parse the numeric values directly so we don't need ts-node.
function loadCoords() {
  const src = fs.readFileSync(
    path.join(__dirname, '../src/card-generator/coords.ts'), 'utf8'
  );
  // Extract all  name: { x: N, y: N, w: N, h: N }  and  name: N  patterns
  const obj = {};
  // Simple numeric property extractor
  for (const m of src.matchAll(/(\w+):\s*\{([^}]+)\}/g)) {
    const key = m[1];
    const inner = {};
    for (const p of m[2].matchAll(/(\w+):\s*([\d.]+)/g)) {
      inner[p[1]] = parseFloat(p[2]);
    }
    obj[key] = inner;
  }
  // Top-level numeric consts
  for (const m of src.matchAll(/^export const (\w+)\s*=\s*([\d.]+)/gm)) {
    obj[m[1]] = parseFloat(m[2]);
  }
  return obj;
}

const C = loadCoords();

const CARD_W     = C.CARD_W     ?? 1024;
const CARD_H     = C.CARD_H     ?? 648;
const COMBINED_W = C.COMBINED_W ?? 1920;
const COMBINED_H = C.COMBINED_H ?? 544;
const PANEL_W    = C.PANEL_W    ?? 960;
const PANEL_H    = C.PANEL_H    ?? 544;

function sx(x) { return Math.round(x * PANEL_W / CARD_W); }
function sy(y) { return Math.round(y * PANEL_H / CARD_H); }
function bsx(x) { return PANEL_W + sx(x); }
function bsy(y) { return sy(y); }

// ── Drawing helpers ───────────────────────────────────────────────────────────
function box(ctx, x, y, w, h, color, label) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  ctx.setLineDash([]);
  ctx.fillStyle = color;
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText(label, x + 3, y + 14);
  ctx.restore();
}

function dot(ctx, x, y, color, label) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '10px sans-serif';
  ctx.fillText(label, x + 6, y + 4);
  ctx.restore();
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const canvas = createCanvas(COMBINED_W, COMBINED_H);
  const ctx    = canvas.getContext('2d');

  const bgPath = path.join(__dirname, '../assets/bg_combined2.png');
  if (fs.existsSync(bgPath)) {
    ctx.drawImage(await loadImage(bgPath), 0, 0, COMBINED_W, COMBINED_H);
  } else {
    ctx.fillStyle = '#e0f0e0'; ctx.fillRect(0, 0, PANEL_W, PANEL_H);
    ctx.fillStyle = '#e0e8f0'; ctx.fillRect(PANEL_W, 0, PANEL_W, PANEL_H);
    ctx.fillStyle = '#999'; ctx.font = '16px sans-serif';
    ctx.fillText('bg_combined.png not found', 20, 30);
  }

  // Panel divider
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PANEL_W, 0); ctx.lineTo(PANEL_W, PANEL_H); ctx.stroke();
  ctx.restore();

  // ── FRONT ─────────────────────────────────────────────────────────────────
  const F = C.portrait ?? {};
  box(ctx, sx(F.x??62), sy(F.y??165), sx(F.w??288), sy(F.h??355), 'red',
    `portrait ${F.x??62},${F.y??165} ${F.w??288}×${F.h??355}`);

  const frontDots = [
    { k: 'nameAmh',    c: '#0066cc' }, { k: 'nameEng',    c: '#0066cc' },
    { k: 'dob',        c: '#009900' }, { k: 'sex',        c: '#9900cc' },
    { k: 'expiry',     c: '#cc6600' },
    { k: 'nameLabel',  c: '#aaaaaa' }, { k: 'dobLabel',   c: '#aaaaaa' },
    { k: 'sexLabel',   c: '#aaaaaa' }, { k: 'expiryLabel',c: '#aaaaaa' },
  ];
  for (const d of frontDots) {
    const p = C[d.k];
    if (p) dot(ctx, sx(p.x), sy(p.y), d.c, `${d.k} (${p.x},${p.y})`);
  }

  const fcn = C.fcnBox ?? {};
  box(ctx, sx(fcn.x??370), sy(fcn.y??455), sx(fcn.w??580), sy(fcn.h??60),
    '#cc3300', `fcnBox ${fcn.x??370},${fcn.y??455} ${fcn.w??580}×${fcn.h??60}`);

  // ── Vertical Issue Dates (left edge of front card) ─────────────────────
  // The template already has "የተሰጠበት ቀን) Date of Issue : " printed.
  // We only draw the date values right after the printed labels.
  const issueEthX = 38;   
  const issueEthY = 530;  // Anchor after the bottom label ends (shifted slightly further down)
  const issueGregX = 38;  // Aligned horizontally with the red box
  const issueGregY = 255; // Anchor after the top label ends (shifted slightly down)

  // Ethiopian issue date value
  ctx.save();
  ctx.translate(sx(issueEthX), sy(issueEthY));
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#cc0000';
  ctx.font = 'bold 22px sans-serif';
  const ethText = '2018/08/13';
  ctx.fillText(ethText, 0, 0);
  const ethW = ctx.measureText(ethText).width;
  ctx.strokeStyle = 'rgba(200,0,0,0.5)';
  ctx.setLineDash([2, 2]);
  ctx.strokeRect(0, -22, ethW, 30);
  ctx.restore();

  // Gregorian issue date value
  ctx.save();
  ctx.translate(sx(issueGregX), sy(issueGregY));
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#0000cc';
  ctx.font = 'bold 22px sans-serif';
  const gregText = '2026/Apr/21';
  ctx.fillText(gregText, 0, 0);
  const gregW = ctx.measureText(gregText).width;
  ctx.strokeStyle = 'rgba(0,0,200,0.5)';
  ctx.setLineDash([2, 2]);
  ctx.strokeRect(0, -22, gregW, 30);
  ctx.restore();

  // Reference dots for the anchor points
  dot(ctx, sx(issueEthX), sy(issueEthY), '#cc0000', `ethDate (${issueEthX},${issueEthY})`);
  dot(ctx, sx(issueGregX), sy(issueGregY), '#0000cc', `gregDate (${issueGregX},${issueGregY})`);

  // Mini portrait (small photo at bottom-right of front panel)
  const mp = C.miniPortrait ?? { x: 740, y: 350, w: 120, h: 160 };
  box(ctx, sx(mp.x), sy(mp.y), sx(mp.w), sy(mp.h), '#ff00ff',
    `miniPortrait ${mp.x},${mp.y} ${mp.w}×${mp.h}`);

  // ── BACK ──────────────────────────────────────────────────────────────────
  const backDots = [
    { k: 'phone', c: '#0066cc' },
    { k: 'nat',   c: '#009900' },
    { k: 'fin',   c: '#333300' },
  ];
  for (const d of backDots) {
    const p = C[d.k];
    if (p) dot(ctx, bsx(p.x), bsy(p.y), d.c, `${d.k} (${p.x},${p.y})`);
  }

  // Address start
  const addrStartY = C.addrStartY ?? 225;
  dot(ctx, bsx(85), bsy(addrStartY), '#cc6600', `addrStart y=${addrStartY}`);

  // Debug boxes for each back field — x=85 in card space, y aligned under template labels
  box(ctx, bsx(85), bsy(85),  sx(250), sy(28), '#0066cc', 'phone area');
  box(ctx, bsx(85), bsy(165), sx(350), sy(28), '#009900', 'nat area');
  box(ctx, bsx(85), bsy(addrStartY), sx(250), sy(120), '#cc6600', 'addr area');
  // (fin area box removed — use finBox only)

  // QR box
  const qr = C.qr ?? { x:480, y:30, w:530, h:490 };
  box(ctx, bsx(qr.x), bsy(qr.y), sx(qr.w), sy(qr.h), 'red',
    `qr ${qr.x},${qr.y} ${qr.w}×${qr.h}`);

  // FIN box
  const finBox = C.finBox ?? { x:100, y:480, w:380, h:40 };
  box(ctx, bsx(finBox.x), bsy(finBox.y), sx(finBox.w), sy(finBox.h), '#0000cc',
    `finBox ${finBox.x},${finBox.y} ${finBox.w}×${finBox.h}`);

  // SN box
  const snBox = C.snBox ?? { x: 810, y: 612, w: 180, h: 30 };
  box(ctx, bsx(snBox.x), bsy(snBox.y), sx(snBox.w), sy(snBox.h), '#ff9900',
    `snBox ${snBox.x},${snBox.y} ${snBox.w}×${snBox.h}`);
  
  const snText = C.snText ?? { x: 820, y: 633 };
  dot(ctx, bsx(snText.x), bsy(snText.y), '#ff9900', 'snText');

  // ── Legend ────────────────────────────────────────────────────────────────
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(4, PANEL_H - 22, 500, 20);
  ctx.fillStyle = '#fff';
  ctx.font = '11px sans-serif';
  ctx.fillText(
    `Canvas: ${COMBINED_W}×${COMBINED_H}  |  Panel: ${PANEL_W}×${PANEL_H}  |  Coord space: ${CARD_W}×${CARD_H}  |  Edit: src/card-generator/coords.ts`,
    8, PANEL_H - 7,
  );
  ctx.restore();

  const out = path.join(__dirname, '../assets/debug_combined.png');
  fs.writeFileSync(out, canvas.toBuffer('image/png'));
  console.log(`✅  Saved: ${out}`);
  console.log(`    QR box: x=${qr.x} y=${qr.y} w=${qr.w} h=${qr.h}`);
  console.log(`    Portrait: x=${F.x??62} y=${F.y??165} w=${F.w??288} h=${F.h??355}`);
  console.log(`    → Edit src/card-generator/coords.ts to adjust, then re-run.`);
}

main().catch(console.error);
