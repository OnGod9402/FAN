/**
 * Draws a red rectangle on bg_front.png at the current portrait coords
 * so you can visually verify the position before running the bot.
 *
 * Run: node scripts/debug-coords.js
 * Output: assets/debug_portrait_box.png
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

const CARD_W = 1024;
const CARD_H = 643;

const x = parseInt(process.env.FRONT_PORTRAIT_X ?? '62');
const y = parseInt(process.env.FRONT_PORTRAIT_Y ?? '165');
const w = parseInt(process.env.FRONT_PORTRAIT_W ?? '288');
const h = parseInt(process.env.FRONT_PORTRAIT_H ?? '368');

const fcnX = parseInt(process.env.FRONT_FCN_BOX_X ?? '515');
const fcnY = parseInt(process.env.FRONT_FCN_BOX_Y ?? '574');
const fcnW = parseInt(process.env.FRONT_FCN_BOX_W ?? '282');
const fcnH = parseInt(process.env.FRONT_FCN_BOX_H ?? '38');

async function main() {
  const canvas = createCanvas(CARD_W, CARD_H);
  const ctx = canvas.getContext('2d');

  const bg = await loadImage(path.join(__dirname, '../assets/bg_front.png'));
  ctx.drawImage(bg, 0, 0, CARD_W, CARD_H);

  // Portrait box — red
  ctx.strokeStyle = 'red';
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = 'red';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`portrait: x=${x} y=${y} w=${w} h=${h}`, x + 4, y + 18);

  // FCN box — blue
  ctx.strokeStyle = 'blue';
  ctx.lineWidth = 3;
  ctx.strokeRect(fcnX, fcnY, fcnW, fcnH);
  ctx.fillStyle = 'blue';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`fcn: x=${fcnX} y=${fcnY} w=${fcnW} h=${fcnH}`, fcnX, fcnY - 5);

  const out = path.join(__dirname, '../assets/debug_portrait_box.png');
  fs.writeFileSync(out, canvas.toBuffer('image/png'));
  console.log(`Saved: ${out}`);
  console.log(`Template size: ${CARD_W}x${CARD_H}`);
  console.log(`Portrait box: x=${x}, y=${y}, w=${w}, h=${h}`);
}

main().catch(console.error);
